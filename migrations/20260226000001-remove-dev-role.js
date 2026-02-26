'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Roles', { name: 'Dev' }, {});
  },

  down: async (queryInterface, Sequelize) => {
  }
};