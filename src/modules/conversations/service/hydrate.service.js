'use strict';

const userRepository = require('../../users/repository/user.repository');
const visitorRepository = require('../../visitors/repository/visitor.repository');
const tagRepository = require('../../tags/repository/tag.repository');
const { serializeConversation } = require('../serializer');

const uniq = (values) => [...new Set(values.filter(Boolean).map(String))];

/**
 * Batch-loads the related documents a conversation payload needs and returns
 * serialized conversations.
 *
 * This exists so list endpoints never trigger N+1 lookups and so both the
 * conversation service and the assignment service shape responses identically.
 * Deliberately no Mongoose `populate`: the queries stay explicit and scoped.
 */
async function hydrateConversations(workspaceId, conversations = []) {
  if (!conversations.length) return [];

  const visitorIds = uniq(conversations.map((c) => c.visitor));
  const userIds = uniq(conversations.map((c) => c.assignedTo));
  const tagIds = uniq(conversations.flatMap((c) => c.tags || []));

  const [visitors, users, tags] = await Promise.all([
    visitorIds.length ? visitorRepository.findByIds(workspaceId, visitorIds) : [],
    userIds.length ? userRepository.findByIds(userIds) : [],
    tagIds.length ? tagRepository.findByIds(workspaceId, tagIds) : [],
  ]);

  const visitorMap = new Map(visitors.map((v) => [String(v._id), v]));
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const tagMap = new Map(tags.map((t) => [String(t._id), t]));

  return conversations.map((conversation) =>
    serializeConversation(conversation, {
      visitor: visitorMap.get(String(conversation.visitor)),
      assignedTo: conversation.assignedTo ? userMap.get(String(conversation.assignedTo)) : null,
      tags: (conversation.tags || []).map((id) => tagMap.get(String(id)) || id),
    }),
  );
}

const hydrateConversation = async (workspaceId, conversation) =>
  (await hydrateConversations(workspaceId, conversation ? [conversation] : []))[0] || null;

module.exports = { hydrateConversation, hydrateConversations };
