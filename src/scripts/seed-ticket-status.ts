import { sequelize } from '../config/db';
import { TicketStatus } from '../modules/tickets/models/ticket-status.model';

const seedTicketStatuses = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');
    await sequelize.sync(); 

    const statuses = ['New', 'Open', 'In Progress', 'Ready for QA', 'In Testing', 'Done', 'Reopened', 'Resolved', 'Closed'];

    console.log('--- TICKET STATUSES ---');
    for (const statusName of statuses) {
      const [status] = await TicketStatus.findOrCreate({
        where: { name: statusName },
        defaults: { name: statusName }
      });
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