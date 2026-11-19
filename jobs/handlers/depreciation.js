// Repositories
const depreciationRepository = require("../../modules/depreciation/depreciation.repository");

// Validations
const depreciationValidation = require("../../modules/depreciation/depreciation.validation");
const vehicleValidation = require("../../modules/vehicle/vehicle.validation");

// Helpers
const depreciationHelpers = require("../../modules/depreciation/depreciation.helper");

exports.depreciationHandler = async ({ depreciationId }) => {
  const depreciation = await depreciationValidation.throwErrorIfDepreciationDoesNotExist(depreciationId);
  const vehicle = await vehicleValidation.throwErrorIfVehicleDoesNotExistsInWorkspace(String(depreciation.vehicle._id), String(depreciation.workspace._id));

  const depreciationExpense = depreciationHelpers.calculateDepreciation({
    method: depreciation.method,
    cost: depreciation.purchaseValue,
    salvageValue: depreciation.salvageValue,
    bookValue: depreciation.bookValue,
    usefulLife: vehicle.usefulLife,
    depreciationRate: depreciation.depreciationRate,
    totalExpectedUnits: depreciation.totalExpectedUnits,
    unitsProduced: depreciation.unitsProduced,
  });

  const accumulatedDepreciation = depreciation.accumulatedDepreciation + depreciationExpense;

  const bookValue = Math.max(depreciation.purchaseValue - accumulatedDepreciation, depreciation.salvageValue || 0);

  const remainingUsefulLife = Math.max(0, vehicle.usefulLife - 1);

  return depreciationRepository.updateDepreciationById(depreciationId, {
    depreciationExpense,
    accumulatedDepreciation,
    bookValue,
    remainingUsefulLife,
  });
};
