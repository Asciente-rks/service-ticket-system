import * as conversationRepository from '../repositories/conversation.repository';
import * as messageRepository from '../repositories/message.repository';
import * as userRepository from '../../users/repositories/user.repository';

const sortedPair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

const otherParticipant = (convo: any, meId: string) => {
  const isUser1 = String(convo.user1Id) === String(meId);
  const other = isUser1 ? convo.user2 : convo.user1;
  return other
    ? { id: other.id, name: other.name, email: other.email }
    : { id: isUser1 ? convo.user2Id : convo.user1Id, name: 'Unknown', email: '' };
};

const toConversationDto = (convo: any, meId: string, unreadCount: number) => ({
  id: convo.id,
  other: otherParticipant(convo, meId),
  lastMessageText: convo.lastMessageText ?? null,
  lastMessageAt: convo.lastMessageAt ?? null,
  lastMessageMine: convo.lastMessageSenderId ? String(convo.lastMessageSenderId) === String(meId) : false,
  unreadCount,
  createdAt: convo.createdAt,
});

const toMessageDto = (m: any) => ({
  id: m.id,
  conversationId: m.conversationId,
  senderId: m.senderId,
  body: m.body,
  readAt: m.readAt ?? null,
  createdAt: m.createdAt,
  sender: m.sender ? { id: m.sender.id, name: m.sender.name, email: m.sender.email } : null,
});

const assertParticipant = (convo: any, organizationId: string, meId: string) => {
  if (
    !convo ||
    String(convo.organizationId) !== String(organizationId) ||
    (String(convo.user1Id) !== String(meId) && String(convo.user2Id) !== String(meId))
  ) {
    const err: any = new Error('Conversation not found.');
    err.statusCode = 404;
    throw err;
  }
};

/** Find-or-create a 1:1 conversation with another member of my organization. */
export const startConversation = async (organizationId: string, meId: string, otherUserId: string) => {
  if (String(meId) === String(otherUserId)) {
    const err: any = new Error('You cannot start a conversation with yourself.');
    err.statusCode = 400;
    throw err;
  }
  const other = await userRepository.findBasicById(otherUserId);
  if (!other || String((other as any).organizationId) !== String(organizationId)) {
    const err: any = new Error('That user is not in your organization.');
    err.statusCode = 404;
    throw err;
  }

  const [u1, u2] = sortedPair(meId, otherUserId);
  let convo = await conversationRepository.findByPair(organizationId, u1, u2);
  if (!convo) {
    convo = await conversationRepository.create({ organizationId, user1Id: u1, user2Id: u2 });
  }
  const full = await conversationRepository.findById(convo.id);
  return toConversationDto(full, meId, 0);
};

export const listConversations = async (organizationId: string, meId: string, search?: string) => {
  const rows = await conversationRepository.findAllForUser(organizationId, meId);
  const unreadMap = await messageRepository.unreadCountsByConversation(rows.map((r: any) => r.id), meId);

  let dtos = rows.map((r: any) => toConversationDto(r, meId, unreadMap.get(String(r.id)) || 0));

  const q = (search || '').trim().toLowerCase();
  if (q) {
    dtos = dtos.filter(
      (d) => d.other.name.toLowerCase().includes(q) || d.other.email.toLowerCase().includes(q),
    );
  }
  // Newest first; empty (never-messaged) conversations fall to the bottom.
  dtos.sort((a, b) => {
    const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bt - at;
  });
  return dtos;
};

export const getMessages = async (organizationId: string, meId: string, conversationId: string) => {
  const convo = await conversationRepository.findById(conversationId);
  assertParticipant(convo, organizationId, meId);

  const messages = await messageRepository.findByConversation(conversationId);
  await messageRepository.markRead(conversationId, meId);

  return {
    conversation: { id: (convo as any).id, other: otherParticipant(convo, meId) },
    messages: messages.map(toMessageDto),
  };
};

export const sendMessage = async (
  organizationId: string,
  meId: string,
  conversationId: string,
  body: string,
) => {
  const convo = await conversationRepository.findById(conversationId);
  assertParticipant(convo, organizationId, meId);

  const trimmed = body.trim();
  const message = await messageRepository.create({ conversationId, senderId: meId, body: trimmed });
  await conversationRepository.touch(conversationId, trimmed.slice(0, 300), meId, message.createdAt);

  const full = (await messageRepository.findByConversation(conversationId)).find((m: any) => m.id === message.id);
  return toMessageDto(full || message);
};

export const getUnreadTotal = async (organizationId: string, meId: string) => {
  const count = await messageRepository.unreadTotalForUser(meId, organizationId);
  return { count };
};
