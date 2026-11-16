'use strict';

const AuditLog = require('../model/auditLog.model');

const create = (data) => AuditLog.create(data);

const insertMany = (docs) => AuditLog.insertMany(docs, { ordered: false });

async function paginate({ filter = {}, skip = 0, limit = 25 }) {
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, total };
}

module.exports = { create, insertMany, paginate };
