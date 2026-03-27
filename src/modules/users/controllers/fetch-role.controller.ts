import { Request, Response } from 'express';
import { sequelize } from '../../../config/db'; // Make sure this path points to your db.ts/config file
import { QueryTypes } from 'sequelize';

export const getRoles = async (req: Request, res: Response) => {
  try {
    // In Sequelize, raw queries return just the data if you specify the type
    const roles = await sequelize.query('SELECT id, name FROM roles', {
      type: QueryTypes.SELECT,
    });

    return res.status(200).json(roles);
  } catch (error) {
    console.error("Fetch Roles Error:", error);
    return res.status(500).json({ error: "Failed to fetch roles from database" });
  }
};