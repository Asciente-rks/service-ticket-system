'use strict';

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const roles = await queryInterface.sequelize.query(
      `SELECT id FROM Roles WHERE name = 'SuperAdmin' LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!roles || roles.length === 0) {
      console.error('SuperAdmin role not found. Please run the roles seeder first.');
      return;
    }

    const superAdminRoleId = roles[0].id;
    const superAdminEmail = 'superadmin@test.com';

    const existingUser = await queryInterface.sequelize.query(
      `SELECT id FROM Users WHERE email = '${superAdminEmail}' LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (existingUser.length === 0) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      await queryInterface.bulkInsert('Users', [{
        id: uuidv4(),
        name: 'Super Admin',
        email: superAdminEmail,
        password: hashedPassword,
        role_id: superAdminRoleId,
        createdAt: new Date(),
        updatedAt: new Date()
      }], {});
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Users', { email: 'superadmin@test.com' }, {});
  }
};