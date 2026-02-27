import { Response } from 'express';
import { AuthRequest } from '../../../middlewares/auth.middleware';
import * as approvalService from '../services/approval.service';
import { CreateApprovalDto } from '../dtos/create-approval.dto';

export const addApproval = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
        
        const approval = await approvalService.approveTicket(req.params.id, req.user.id, req.body as CreateApprovalDto);
        res.status(201).json(approval);
    } catch (error: any) {
        if (error.message.includes('Only Admins and SuperAdmins')) {
            return res.status(403).json({ message: error.message });
        }
        if (error.message.includes('Invalid status') || error.message.includes('not found')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error adding approval', error: error.message });
    }
};