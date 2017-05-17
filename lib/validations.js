const validate = require('validate.js');

const VALID_ID = {
  onlyInteger: true,
  greaterThan: 0
};

const USER_VALIDATION = {
  email: {
    presence: true,
    email: true
  },
  password: {
    presence: true,
  }
};
exports.user = function validateUser(userData) {
  return validate(userData, USER_VALIDATION);
};

const PLANT_VALIDATION = {
  userId: {
    presence: true,
    numericality: VALID_ID
  },
  name: {
    presence: true
  },
  nickname: {
    presence: true
  }
};
exports.plant = function validatePlant(plantData) {
  return validate(plantData, PLANT_VALIDATION);
};

const PLANT_UPDATE_VALIDATION = {
  userId: {
    numericality: VALID_ID
  }
};
exports.boardUpdate = function validateBoardUpdate(boardData) {
  return validate(boardData, BOARD_UPDATE_VALIDATION);
};

const CREDS_VALIDATION = {
  email: {
    presence: true,
    email: true
  },
  password: {
    presence: true
  }
};
exports.credentials = function validateCredentials(credsData) {
  return validate(credsData, CREDS_VALIDATION);
};
