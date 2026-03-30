import { Request, Response } from 'express';
import * as roleRepository from '../repositories/role.repository';

let rolesCache: any[] | null = null;

export const getRoles = async (req: Request, res: Response) => {
  try {
    if (rolesCache) {
      return res.status(200).json(rolesCache);
    }

    const roles = await roleRepository.findAll();
    rolesCache = roles;

    return res.status(200).json(roles);
  } catch (error) {
    console.error("Fetch Roles Error:", error);
    return res.status(500).json({ error: "Failed to fetch roles from database" });
  }
};