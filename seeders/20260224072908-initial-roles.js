'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const existingRoles = await queryInterface.sequelize.query(
      'SELECT name FROM Roles',
      { type: Sequelize.QueryTypes.SELECT }
    );
    const existingNames = existingRoles.map(r => r.name);

    const roles = [
      {
        id: uuidv4(),
        name: 'SuperAdmin',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        name: 'Admin',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        name: 'Developer',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        name: 'Tester',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const newRoles = roles.filter(r => !existingNames.includes(r.name));

    if (newRoles.length > 0) {
      await queryInterface.bulkInsert('Roles', newRoles, {});
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Roles', null, {});
  }
};