import { Request, Response } from 'express';
import { sequelize } from '../../../config/db'; 
import { QueryTypes } from 'sequelize';

export const getStatuses = async (req: Request, res: Response) => {
  try {
    // Fetch the ID and Name from your ticket_statuses table
    const statuses = await sequelize.query('SELECT id, name FROM ticket_statuses', {
      type: QueryTypes.SELECT,
    });

    return res.status(200).json(statuses);
  } catch (error) {
    console.error("Fetch Statuses Error:", error);
    return res.status(500).json({ error: "Failed to fetch statuses from database" });
  }
};