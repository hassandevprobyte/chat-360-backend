const lodash = require("lodash");

// Repositories
const picklistRepository = require("./picklist.repository");

// Validations
const joi = require("../../config/joi");
const joiSchema = require("./picklist.schema");
const picklistValidation = require("./picklist.validation");
const workspaceValidation = require("../workspace/workspace.validation");

// Helpers
const picklistHelpers = require("./picklist.helper");

exports.getAllPicklists = async (filters) => {
  return picklistRepository.getAllPicklists(filters);
};

exports.getPicklistCategories = async (filters) => {
  const picklists = await picklistRepository.getAllPicklists(filters);

  const categories = [
    ...new Map(
      picklists.map((picklist) => {
        const key = `${picklist.resource}.${picklist.field}`;

        return [
          key,
          {
            key,
            resource: picklist.resource ?? null,
            field: picklist.field,
          },
        ];
      }),
    ).values(),
  ];

  return categories;
};

exports.getPicklistsWithPagination = async (payload) => {
  const { filters, page, pageSize, sort } = payload;
  const offset = (page - 1) * pageSize;

  const [picklists, totalCount] = await Promise.all([
    picklistRepository.getPicklistsWithPagination(filters, offset, pageSize, sort),
    picklistRepository.getPicklistsCount(filters),
  ]);

  const meta = { totalCount, totalPages: Math.ceil(totalCount / pageSize), page, pageSize };

  return { data: picklists, meta };
};

exports.getPicklistById = async (picklistId) => {
  joi.validate(picklistId, joiSchema.getPicklistById);

  return picklistValidation.throwErrorIfPicklistDoesNotExist(picklistId);
};

exports.createPicklist = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.createPicklist);

  await workspaceValidation.throwErrorIfWorkspaceDoesNotExist(validatedPayload.workspace);

  validatedPayload.value = validatedPayload.title.toLowerCase();

  picklistValidation.throwErrorIfResourceOrFieldIsInvalid(validatedPayload.resource, validatedPayload.field);
  await picklistValidation.throwErrorIfPicklistValueExistsInContext(
    validatedPayload.value,
    validatedPayload.workspace,
    validatedPayload.resource,
    validatedPayload.field,
    validatedPayload.parentPicklist,
  );

  if (validatedPayload.acronym) {
    await picklistValidation.throwErrorIfPicklistAcronymExistsInContext(
      validatedPayload.acronym,
      validatedPayload.workspace,
      validatedPayload.resource,
      validatedPayload.field,
      validatedPayload.parentPicklist,
    );
  }

  if (validatedPayload.parentPicklist) {
    await picklistValidation.throwErrorIfPicklistDoesNotExistInContext(validatedPayload.parentPicklist, validatedPayload.workspace, validatedPayload.resource);
  }

  validatedPayload.isDefault = await picklistHelpers.resolveDefaultPicklistInContext(
    validatedPayload.workspace,
    validatedPayload.resource,
    validatedPayload.field,
    validatedPayload.parentPicklist,
    validatedPayload.isDefault,
  );

  return picklistRepository.createPicklist(validatedPayload);
};

exports.updatePicklist = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.updatePicklist);

  console.log(validatedPayload);

  const existingPicklist = await picklistValidation.throwErrorIfPicklistDoesNotExist(validatedPayload.id);

  const updatePayload = {};

  const updatedResource = validatedPayload.resource || existingPicklist.resource;
  const updatedField = validatedPayload.field || existingPicklist.field;
  const updatedParentPicklist = validatedPayload.parentPicklist ? validatedPayload.parentPicklist : (String(existingPicklist?.parentPicklist?._id) ?? null);

  const contextChanged =
    updatedResource !== existingPicklist.resource || updatedField !== existingPicklist.field || updatedParentPicklist !== String(existingPicklist.parentPicklist?._id);

  if (validatedPayload.title && validatedPayload.title !== existingPicklist.title) {
    updatePayload.title = validatedPayload.title;
    updatePayload.value = updatePayload.title.toLowerCase();
  }

  if (validatedPayload.acronym && validatedPayload.acronym !== existingPicklist.acronym) {
    updatePayload.acronym = validatedPayload.acronym;
  }

  if (validatedPayload.hasOwnProperty("preserveTitleFormatting") && validatedPayload.preserveTitleFormatting !== existingPicklist.preserveTitleFormatting) {
    updatePayload.preserveTitleFormatting = validatedPayload.preserveTitleFormatting;
  }

  if (validatedPayload.resource && validatedPayload.resource !== existingPicklist.resource) {
    updatePayload.resource = validatedPayload.resource;
  }

  if (validatedPayload.field && validatedPayload.field !== existingPicklist.field) {
    updatePayload.field = validatedPayload.field;
  }

  if ((validatedPayload.parentPicklist !== undefined && validatedPayload.parentPicklist !== String(existingPicklist?.parentPicklist?._id)) || updatePayload.resource) {
    await picklistValidation.throwErrorIfPicklistDoesNotExistInContext(updatedParentPicklist, String(existingPicklist.workspace?._id), updatedResource);

    updatePayload.parentPicklist = validatedPayload.parentPicklist;
  }

  if (validatedPayload.color && validatedPayload.color !== existingPicklist.color) {
    updatePayload.color = validatedPayload.color;
  }

  if (validatedPayload.order && validatedPayload.order !== existingPicklist.order) {
    updatePayload.order = validatedPayload.order;
  }

  if (validatedPayload.hasOwnProperty("isActive") && validatedPayload.isActive !== existingPicklist.isActive) {
    updatePayload.isActive = validatedPayload.isActive;
  }

  if ((validatedPayload.hasOwnProperty("isDefault") && validatedPayload.isDefault !== existingPicklist.isDefault) || contextChanged) {
    updatePayload.isDefault = await picklistHelpers.resolveDefaultPicklistInContext(
      String(existingPicklist.workspace?._id),
      updatedResource,
      updatedField,
      updatedParentPicklist,
      validatedPayload.isDefault,
    );
  }

  if (Object.keys(validatedPayload.meta).length > 0 && !lodash.isEqual(validatedPayload.meta, existingPicklist.meta)) {
    updatePayload.meta = validatedPayload.meta;
  }

  if (updatePayload.value || contextChanged) {
    const updatedValue = updatePayload.value || existingPicklist.value;

    picklistValidation.throwErrorIfResourceOrFieldIsInvalid(updatedResource, updatedField);
    await picklistValidation.throwErrorIfPicklistValueExistsInContext(updatedValue, String(existingPicklist.workspace?._id), updatedResource, updatedField, updatedParentPicklist);
  }

  if (updatePayload.acronym || contextChanged) {
    const updatedAcronym = updatePayload.acronym || existingPicklist.acronym;

    await picklistValidation.throwErrorIfPicklistAcronymExistsInContext(
      updatedAcronym,
      String(existingPicklist.workspace?._id),
      updatedResource,
      updatedField,
      updatedParentPicklist,
    );
  }

  if (!Object.keys(updatePayload).length) return existingPicklist;

  return picklistRepository.updatePicklistById(validatedPayload.id, updatePayload);
};

exports.reorderPicklist = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.reorderPicklist);

  await picklistValidation.throwErrorIfPicklistDoesNotExist(validatedPayload.draggedPicklistId);
  await picklistValidation.throwErrorIfPicklistDoesNotExist(validatedPayload.targetPicklistId);

  if (validatedPayload.targetParentPicklistId) {
    await picklistValidation.throwErrorIfPicklistDoesNotExist(validatedPayload.targetParentPicklistId);
  }

  const { draggedPicklistId, targetPicklistId, targetParentPicklistId } = validatedPayload;

  const filters = { parentPicklist: targetParentPicklistId ?? null };

  const siblings = await picklistRepository.getAllPicklists(filters);

  const dragged = siblings.find((p) => p._id.toString() === draggedPicklistId);
  const target = siblings.find((p) => p._id.toString() === targetPicklistId);

  const filtered = siblings.filter((p) => p._id.toString() !== draggedPicklistId);

  const targetIndex = filtered.findIndex((p) => p._id.toString() === targetPicklistId);

  filtered.splice(targetIndex, 0, dragged);

  // 4. Compute fractional order
  const prev = filtered[targetIndex - 1];
  const next = filtered[targetIndex + 1];

  let newOrder;

  if (!prev && !next) {
    newOrder = 100;
  } else if (!prev) {
    newOrder = next.order / 2;
  } else if (!next) {
    newOrder = prev.order + 100;
  } else {
    newOrder = (prev.order + next.order) / 2;
  }

  // 5. Detect parent change
  const newParent = targetParentPicklistId !== undefined ? targetParentPicklistId : (dragged.parentPicklist ?? null);

  // 6. Apply update (ONLY ONE WRITE)
  const updated = await Picklist.findByIdAndUpdate(
    draggedPicklistId,
    {
      order: newOrder,
      parentPicklist: newParent,
    },
    { new: true },
  );

  return updated;
};

exports.deletePicklist = async (picklistId) => {
  joi.validate(picklistId, joiSchema.getPicklistById);

  await Promise.all([
    picklistValidation.throwErrorIfPicklistDoesNotExist(picklistId),
    picklistValidation.throwErrorIfDefaultPicklistIsBeingDeleted(picklistId),
    picklistValidation.throwErrorIfParentPicklistIsBeingDeleted(picklistId),
    picklistValidation.throwErrorIfPicklistIsAssignedOnResource(picklistId),
  ]);

  await picklistRepository.deletePicklistById(picklistId);

  return { deletedId: picklistId };
};
