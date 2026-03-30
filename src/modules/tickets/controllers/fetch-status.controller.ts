import { Request, Response } from 'express';
import * as ticketStatusRepository from '../repositories/ticket-status.repository';

// Static data cache to minimize database hits
let statusCache: any[] | null = null;

export const getStatuses = async (req: Request, res: Response) => {
  try {
    if (statusCache) {
      return res.status(200).json(statusCache);
    }

    const statuses = await ticketStatusRepository.findAll();
    statusCache = statuses;

    return res.status(200).json(statuses);
  } catch (error) {
    console.error("Fetch Statuses Error:", error);
    return res.status(500).json({ error: "Failed to fetch statuses from database" });
  }
};