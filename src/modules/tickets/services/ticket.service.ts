import { CreateTicketDto } from '../dtos/create-ticket.dto';
import { TicketResponseDto } from '../dtos/ticket-response.dto';
import { UpdateTicketDto } from '../dtos/update-ticket.dto';
import * as ticketRepository from '../repositories/ticket.repository';
import * as ticketStatusRepository from '../repositories/ticket-status.repository';
import * as userRepository from '../../users/repositories/user.repository';
import * as notificationService from '../../notifications/services/notification.service';
import * as notificationRepository from '../../notifications/repositories/notification.repository';
import * as notificationSettingService from '../../users/services/notification-setting.service';
import * as ticketEventService from './ticket-event.service';
import * as commentRepository from '../repositories/comment.repository';
import * as ticketEventRepository from '../repositories/ticket-event.repository';
import { ROLES } from '../../../config/roles';
import { STATUSES } from '../../../config/statuses';
import * as collectionService from '../../collections/services/collection.service';
import { PlatformVersion } from '../../collections/models/platform-version.model';

const VALID_PRIORITIES = ['Low', 'Medium', 'High'];

const ROLE = {
    superAdmin: ROLES.SUPER_ADMIN.toLowerCase(),
    admin: ROLES.ADMIN.toLowerCase(),
    dev: ROLES.DEVELOPER.toLowerCase(),
    tester: ROLES.TESTER.toLowerCase(),
};

/** Dedupe a list of ids, dropping falsy values, preserving order. */
const uniqueIds = (ids: (string | null | undefined)[]): string[] =>
    Array.from(new Set(ids.filter((x): x is string => !!x).map((x) => String(x))));

/**
 * Validate that `assigneeId` may be assigned by `actor` under the tenant and
 * role rules. Throws a 400-style Error on violation. Assigning to oneself is
 * always allowed; SuperAdmins (as actor) may assign to anyone except other
 * SuperAdmins.
 */
const assertAssignable = async (
    assigneeId: string,
    actorId: string,
    actorRoleId: string,
    organizationId: string,
): Promise<void> => {
    const assignee = await userRepository.findBasicById(assigneeId);
    if (!assignee) {
        throw new Error('Assignee user not found.');
    }
    if (String((assignee as any).organizationId) !== String(organizationId)) {
        throw new Error('Assignee must belong to your organization.');
    }

    // Assigning to yourself is always permitted.
    if (String(assignee.id) === String(actorId)) return;

    const assigneeRole = (assignee.roleId || '').toLowerCase();
    const actorRole = (actorRoleId || '').toLowerCase();

    if (assigneeRole === ROLE.superAdmin) {
        throw new Error('Tickets cannot be assigned to SuperAdmins.');
    }

    if (actorRole === ROLE.admin) {
        if (![ROLE.dev, ROLE.tester].includes(assigneeRole)) {
            throw new Error('Admins can only assign tickets to Developers and Testers.');
        }
    } else if (actorRole === ROLE.tester) {
        if (![ROLE.dev, ROLE.tester].includes(assigneeRole)) {
            throw new Error('Testers can only assign tickets to Developers and fellow Testers.');
        }
    } else if (actorRole === ROLE.dev) {
        if (![ROLE.dev, ROLE.tester].includes(assigneeRole)) {
            throw new Error('Developers can only assign tickets to fellow Developers and Testers.');
        }
    }
    // SuperAdmin actor: no further restriction.
};

/**
 * Resolve and validate an optional platform/version selection: it must exist,
 * belong to the org, and (when known) belong to the ticket's collection.
 */
const resolvePlatformVersionId = async (
    organizationId: string,
    collectionId: string | null,
    platformVersionId: string | null | undefined,
): Promise<string | null> => {
    if (!platformVersionId) return null;
    const pv = await PlatformVersion.findByPk(platformVersionId);
    if (!pv || String(pv.organizationId) !== String(organizationId)) {
        const err: any = new Error('Selected platform/version was not found.');
        err.statusCode = 400;
        throw err;
    }
    if (collectionId && String(pv.collectionId) !== String(collectionId)) {
        const err: any = new Error('Selected platform/version does not belong to this collection.');
        err.statusCode = 400;
        throw err;
    }
    return pv.id;
};

/** Notify a set of assignees that they were put on a ticket (best-effort). */
const notifyAssigned = async (
    userIds: string[],
    ticketId: string,
    ticketTitle: string,
    organizationId: string,
    excludeUserId?: string,
) => {
    for (const userId of userIds) {
        if (excludeUserId && String(userId) === String(excludeUserId)) continue;
        try {
            const settings = await notificationSettingService.getNotificationSettings(userId);
            if (settings.notifyAssignedTicket) {
                await notificationService.createNotification({
                    userId,
                    ticketId,
                    organizationId,
                    message: `You have been assigned a ticket: ${ticketTitle}`,
                });
            }
        } catch (err) {
            console.error('Assignment notification failed:', err);
        }
    }
};

export const createTicket = async (ticketData: CreateTicketDto, reporterId: string, reporterRoleId: string, organizationId: string): Promise<TicketResponseDto> => {
    if (!VALID_PRIORITIES.includes(ticketData.priority)) {
        throw new Error(`Invalid priority. Allowed values: ${VALID_PRIORITIES.join(', ')}`);
    }

    const openStatus = await ticketStatusRepository.findByName('Open');

    if (!openStatus) {
        throw new Error('Default ticket status "Open" not found. Please run the seed script.');
    }

    // Accept both the legacy single assigneeId and the new assigneeIds[]. The
    // first entry becomes the primary/lifecycle owner (tickets.assigned_to).
    const requestedAssignees = uniqueIds([...(ticketData.assigneeIds || []), ticketData.assigneeId]);
    for (const assigneeId of requestedAssignees) {
        await assertAssignable(assigneeId, reporterId, reporterRoleId, organizationId);
    }
    const primaryAssignee = requestedAssignees[0] || null;

    // Every ticket lives in a collection: validate the requested one belongs
    // to this org, or fall back to the org's default collection.
    let collectionId: string;
    if (ticketData.collectionId) {
        const collection = await collectionService.assertCollectionInOrg(organizationId, ticketData.collectionId);
        collectionId = collection.id;
    } else {
        const collection = await collectionService.getDefaultCollection(organizationId, reporterId);
        collectionId = collection.id;
    }

    // Platform/versions: accept the new multi (platformVersionIds) and the legacy
    // single (platformVersionId). The first becomes the primary column value.
    const requestedPlatformVersions = uniqueIds([...(ticketData.platformVersionIds || []), ticketData.platformVersionId]);
    for (const pvId of requestedPlatformVersions) {
        await resolvePlatformVersionId(organizationId, collectionId, pvId);
    }
    const primaryPlatformVersion = requestedPlatformVersions[0] || null;

    const ticket = await ticketRepository.create({
        organizationId,
        collectionId,
        platformVersionId: primaryPlatformVersion,
        title: ticketData.title,
        description: ticketData.description,
        jamUrl: ticketData.jamUrl ?? null,
        priority: ticketData.priority,
        reportedBy: reporterId,
        assignedTo: primaryAssignee,
        statusId: STATUSES.OPEN
    });

    // Persist the full assignee set (mirrors the primary + any extras).
    if (requestedAssignees.length) {
        await ticketRepository.setAssignees(ticket.id, organizationId, requestedAssignees, reporterId);
    }
    // Persist the full platform/version set.
    if (requestedPlatformVersions.length) {
        await ticketRepository.setPlatformVersions(ticket.id, organizationId, requestedPlatformVersions);
    }

    const ticketWithAssociations = await ticketRepository.findById(ticket.id);
    if (!ticketWithAssociations) throw new Error('Error fetching created ticket');

    const createdTicket = toTicketResponseDto(ticketWithAssociations);

    // Timeline: ticket reported (+ initial assignment if any).
    await ticketEventService.logEvent({ ticketId: ticket.id, organizationId, actorId: reporterId, type: 'reported' });
    if (primaryAssignee) {
        await ticketEventService.logEvent({
            ticketId: ticket.id,
            organizationId,
            actorId: reporterId,
            type: 'assigned',
            toValue: (ticketWithAssociations as any).assignee?.name ?? null,
        });
    }

    // Notify every assignee (except the reporter themselves).
    await notifyAssigned(requestedAssignees, ticket.id, ticket.title, organizationId, reporterId);

    return createdTicket;
}

export const getAllTickets = async (userId: string, roleId: string, organizationId: string, collectionId?: string): Promise<TicketResponseDto[]> => {
    const whereClause: any = { organizationId };
    if (collectionId) whereClause.collectionId = collectionId;

    const tickets = await ticketRepository.findAll(whereClause);

    return tickets.map(ticket => toTicketResponseDto(ticket));
};

export const getTicketById = async (id: string, organizationId: string): Promise<TicketResponseDto | null> => {
    const ticket = await ticketRepository.findById(id);

    if (!ticket) return null;
    if (String((ticket as any).organizationId) !== String(organizationId)) return null;

    return toTicketResponseDto(ticket);
}

export const deleteTicket = async (id: string, organizationId: string, userId: string, roleId: string): Promise<boolean> => {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) return false;

    // Tenant isolation: never act on another organization's ticket.
    if (String((ticket as any).organizationId) !== String(organizationId)) return false;

    const actorRole = (roleId || '').toLowerCase();
    const isAdmin =
        actorRole === ROLES.SUPER_ADMIN.toLowerCase() ||
        actorRole === ROLES.ADMIN.toLowerCase();
    const isReporter = String(ticket.reportedBy) === String(userId);

    // Admins/SuperAdmins can delete any ticket in their org; reporters can delete their own.
    if (!isAdmin && !isReporter) {
        const err: any = new Error('You are not allowed to delete this ticket.');
        err.statusCode = 403;
        throw err;
    }

    // Remove dependent rows first so nothing is orphaned (notifications, comments,
    // timeline events, assignee links). Notifications have no DB cascade, so always clean explicitly.
    await notificationRepository.deleteByTicketId(id);
    await commentRepository.deleteByTicket(id);
    await ticketEventRepository.deleteByTicket(id);
    await ticketRepository.setAssignees(id, organizationId, []); // clear assignee links

    await ticketRepository.remove(id);
    return true;
};

export const updateTicket = async (id: string, updates: UpdateTicketDto, userId: string, roleId: string, organizationId: string): Promise<TicketResponseDto | null> => {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) return null;
    if (String((ticket as any).organizationId) !== String(organizationId)) return null;

    if (updates.priority && !VALID_PRIORITIES.includes(updates.priority)) {
        throw new Error(`Invalid priority. Allowed values: ${VALID_PRIORITIES.join(', ')}`);
    }

    // Moving a ticket between collections: target must belong to this org.
    let effectiveCollectionId: string | null = (ticket as any).collectionId ?? null;
    if (updates.collectionId !== undefined) {
        if (updates.collectionId) {
            const target = await collectionService.assertCollectionInOrg(organizationId, updates.collectionId);
            effectiveCollectionId = target.id;
        } else {
            delete (updates as any).collectionId; // never detach a ticket from all collections
        }
    }

    const updatesAny = updates as any;

    // Status transitions drive an automatic primary-owner change:
    //   In Progress  -> the developer who picked it up (the actor)
    //   Ready for QA -> back to the reporter for verification
    // This owner is added to the assignee set without removing the others.
    let statusDrivenPrimary: string | null = null;
    if (updatesAny.status) {
        const statusEntity = await ticketStatusRepository.findByName(updatesAny.status);
        if (!statusEntity) {
            throw new Error(`Status "${updatesAny.status}" not found`);
        }

        if (statusEntity.name === 'In Progress') {
            statusDrivenPrimary = userId;
        } else if (statusEntity.name === 'Ready for QA') {
            statusDrivenPrimary = ticket.reportedBy;
        }

        updates.statusId = statusEntity.id;
        delete updatesAny.status;
    }

    // Resolve the desired assignee SET and PRIMARY.
    const currentSet: string[] = ((ticket as any).assignees || []).map((u: any) => String(u.id));
    const hasExplicitSet = Array.isArray(updates.assigneeIds);

    // Base set: explicit list when provided, otherwise the current roster.
    let desiredSet = hasExplicitSet
        ? uniqueIds([...(updates.assigneeIds || []), updates.assigneeId])
        : [...currentSet];

    // Validate any user-chosen assignees that are newly added (status-driven
    // owners are automatic lifecycle changes and skip the role gate).
    const additions = desiredSet.filter((u) => !currentSet.includes(u));
    for (const assigneeId of additions) {
        await assertAssignable(assigneeId, userId, roleId, organizationId);
    }

    // Determine the primary/lifecycle owner.
    let primary: string | null;
    if (statusDrivenPrimary) {
        primary = statusDrivenPrimary;
    } else if (hasExplicitSet) {
        primary = desiredSet[0] || null;
    } else if (updates.assigneeId !== undefined) {
        primary = updates.assigneeId || null;
        if (primary) await assertAssignable(primary, userId, roleId, organizationId);
    } else {
        primary = (ticket as any).assignedTo ? String((ticket as any).assignedTo) : null;
    }

    // The primary must be part of the set (added at the front, no duplicates).
    if (primary) {
        desiredSet = uniqueIds([primary, ...desiredSet]);
    }

    const assigneeSetChanged =
        hasExplicitSet ||
        !!statusDrivenPrimary ||
        updates.assigneeId !== undefined ||
        desiredSet.length !== currentSet.length ||
        desiredSet.some((u) => !currentSet.includes(u));

    // Resolve the desired platform/version SET (multi) and primary.
    const collectionChanged =
        updates.collectionId !== undefined &&
        String(effectiveCollectionId ?? '') !== String((ticket as any).collectionId ?? '');
    const currentPVs: string[] = ((ticket as any).platformVersions || []).map((p: any) => String(p.id));
    const hasExplicitPVs = Array.isArray(updates.platformVersionIds);
    // Any intent to change the platform/version set?
    const pvIntent = hasExplicitPVs || updates.platformVersionId !== undefined || collectionChanged;

    let desiredPVs: string[] = [...currentPVs];
    if (hasExplicitPVs) {
        desiredPVs = uniqueIds([...(updates.platformVersionIds || []), updates.platformVersionId]);
    } else if (updates.platformVersionId !== undefined) {
        // Legacy single value provided — treat as the whole set.
        desiredPVs = updates.platformVersionId ? [String(updates.platformVersionId)] : [];
    }
    if (collectionChanged && !hasExplicitPVs && updates.platformVersionId === undefined) {
        // Moved to a different collection — the old platform/versions (which
        // belonged to the previous collection) no longer apply.
        desiredPVs = [];
    }

    if (pvIntent) {
        for (const pvId of desiredPVs) {
            await resolvePlatformVersionId(organizationId, effectiveCollectionId, pvId);
        }
        updatesAny.platformVersionId = desiredPVs[0] || null;
    }
    const pvSetChanged =
        pvIntent &&
        (desiredPVs.length !== currentPVs.length || desiredPVs.some((p) => !currentPVs.includes(p)));

    // Build the column-level update (assignedTo mirrors the primary; the
    // assigneeId/assigneeIds inputs are not columns and must not be persisted).
    const updateData: any = { ...updates };
    delete updateData.assigneeId;
    delete updateData.assigneeIds;
    delete updateData.platformVersionIds;
    updateData.assignedTo = primary;

    await ticketRepository.update(id, updateData);
    if (assigneeSetChanged) {
        await ticketRepository.setAssignees(id, organizationId, desiredSet, userId);
    }
    if (pvSetChanged) {
        await ticketRepository.setPlatformVersions(id, organizationId, desiredPVs);
    }

    const updatedTicket = await ticketRepository.findById(id);

    // Notify newly added assignees (excluding the actor).
    const newlyAdded = desiredSet.filter((u) => !currentSet.includes(u));
    await notifyAssigned(newlyAdded, id, ticket.title, organizationId, userId);

    // Timeline: log assignment/reassignment and status transitions based on the
    // actual before/after saved values (catches status-driven auto-reassignments).
    const beforeAssignee = (ticket as any).assignedTo ? String((ticket as any).assignedTo) : null;
    const afterAssignee = (updatedTicket as any).assignedTo ? String((updatedTicket as any).assignedTo) : null;
    if (beforeAssignee !== afterAssignee) {
        await ticketEventService.logEvent({
            ticketId: id,
            organizationId,
            actorId: userId,
            type: beforeAssignee ? 'reassigned' : 'assigned',
            fromValue: (ticket as any).assignee?.name ?? null,
            toValue: (updatedTicket as any).assignee?.name ?? null,
        });
    }
    const beforeStatus = (ticket as any).status?.name ?? null;
    const afterStatus = (updatedTicket as any).status?.name ?? null;
    if (beforeStatus !== afterStatus) {
        await ticketEventService.logEvent({
            ticketId: id,
            organizationId,
            actorId: userId,
            type: 'status_changed',
            fromValue: beforeStatus,
            toValue: afterStatus,
        });
    }

    if (updates.statusId && ticket.statusId !== updates.statusId) {
        const statusName = (updatedTicket as any).status.name;

        if (ticket.reportedBy !== userId) {
            const settings = await notificationSettingService.getNotificationSettings(ticket.reportedBy);
            if (settings.notifyReportedTicket) {
                await notificationService.createNotification({
                    userId: ticket.reportedBy,
                    ticketId: ticket.id,
                    organizationId,
                    message: `The status of your ticket "${ticket.title}" has been updated to ${statusName}.`
                });
            }
        }

        // Notify everyone currently assigned (the full roster) about the status change.
        const notifyTargets = uniqueIds(((updatedTicket as any).assignees || []).map((u: any) => String(u.id)));
        for (const target of notifyTargets) {
            if (String(target) === String(userId)) continue;
            const settings = await notificationSettingService.getNotificationSettings(target);
            if (settings.notifyAssignedTicket) {
                await notificationService.createNotification({
                    userId: target,
                    ticketId: ticket.id,
                    organizationId,
                    message: `The status of ticket "${ticket.title}" assigned to you has been updated to ${statusName}.`
                });
            }
        }
    }
    return toTicketResponseDto(updatedTicket);
};

const toTicketResponseDto = (ticket: any): TicketResponseDto => {
    let reviewedBy = null;
    let approvalStatus = null;
    let approvalComment = null;

    if (ticket.approvals && ticket.approvals.length > 0) {
        const latestApproval = ticket.approvals.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        if (latestApproval) {
            reviewedBy = latestApproval.approver ? latestApproval.approver.name : null;
            approvalStatus = latestApproval.status;
            approvalComment = latestApproval.comment;
        }
    }

    const assignees = Array.isArray(ticket.assignees)
        ? ticket.assignees.map((u: any) => ({ id: u.id, name: u.name, email: u.email }))
        : [];

    // Primary assignee (lifecycle owner). Fall back to the first of the set so
    // the field is populated even for rows created before this column existed.
    const primary = ticket.assignee
        ? { id: ticket.assignee.id, name: ticket.assignee.name, email: ticket.assignee.email }
        : assignees[0] || null;

    const toPvDto = (p: any) => ({
        id: p.id,
        platform: p.platform,
        version: p.version,
        label: `${p.platform} · ${p.version}`,
    });
    const platformVersions = Array.isArray(ticket.platformVersions)
        ? ticket.platformVersions.map(toPvDto)
        : [];
    // Primary platform/version (column), falling back to the first of the set.
    const pv = ticket.platformVersion ? toPvDto(ticket.platformVersion) : platformVersions[0] || null;

    return {
        id: ticket.id,
        collectionId: ticket.collectionId ?? ticket.collection?.id ?? null,
        collectionName: ticket.collection?.name ?? null,
        title: ticket.title,
        description: ticket.description,
        jamUrl: ticket.jamUrl ?? null,
        status: ticket.status.name,
        priority: ticket.priority,
        reporter: {
            id: ticket.reporter.id,
            name: ticket.reporter.name,
            email: ticket.reporter.email
        },
        assignee: primary,
        assignees,
        platformVersionId: ticket.platformVersionId ?? ticket.platformVersion?.id ?? null,
        platformVersion: pv,
        platformVersions,
        reviewedBy,
        approvalStatus,
        comment: approvalComment,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt
    };
}
