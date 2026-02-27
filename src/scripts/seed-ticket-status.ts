import { sequelize } from '../config/db';
import * as ticketStatusRepository from '../modules/tickets/repositories/ticket-status.repository';

const seedTicketStatuses = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');
    await sequelize.sync(); 

    const statuses = ['Open', 'In Progress', 'Ready for QA', 'Error Persists', 'Resolved', 'Closed'];
    const oldStatuses = ['New', 'In Testing', 'Done', 'Reopened'];

    const deletedCount = await ticketStatusRepository.deleteByNames(oldStatuses);
    if (deletedCount > 0) console.log(`Removed ${deletedCount} old status(es).`);

    console.log('--- TICKET STATUSES ---');
    for (const statusName of statuses) {
      const [status] = await ticketStatusRepository.findOrCreate(statusName);
      console.log(`${statusName}: ${status.id}`);
    }
    console.log('-----------------------');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Unable to seed ticket statuses:', error);
    process.exit(1);
  }
};

seedTicketStatuses();