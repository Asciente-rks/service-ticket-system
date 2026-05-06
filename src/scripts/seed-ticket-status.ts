import { sequelize, connectDB } from '../config/db';
import { TicketStatus } from '../modules/tickets/models/ticket-status.model';

const SYSTEM_STATUSES = [
  { id: '4412b27b-47b6-4197-baf5-f01eb23dbbd1', name: 'Open' },
  { id: '78ecbd2d-69f0-4f30-b133-7aeb6a05cbc0', name: 'In Progress' },
  { id: 'abd63053-bd1a-4e6b-9dc5-b10d0ccd2e2e', name: 'Ready for QA' },
  { id: '1be8b313-f7a7-4ad9-8f85-55dc35630b82', name: 'Error Persists' },
  { id: '256698fa-3abb-4856-85be-b4fee7397a47', name: 'Resolved' },
  { id: 'fcb58a0d-5d9d-4efa-869b-c571400c91c9', name: 'Closed' }
];

const seedTicketStatuses = async () => {
  try {
    await connectDB();

    console.log('--- STARTING TICKET STATUS SEEDING (UPSERT) ---');

    for (const statusData of SYSTEM_STATUSES) {
      const [status, created] = await TicketStatus.upsert({
        id: statusData.id,
        name: statusData.name,
      });

      if (created) {
        console.log(`CREATED: ${status.name} with ID: ${status.id}`);
      } else {
        console.log(`EXISTS/UPDATED: ${status.name} with ID: ${status.id}`);
      }
    }

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('FATAL: Unable to seed ticket statuses:', error);
    process.exit(1);
  }
};

seedTicketStatuses();