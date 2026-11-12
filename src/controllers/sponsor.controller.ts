import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';

export class SponsorController {
  static async getPublicSponsors(_req: Request, res: Response) {
    try {
      const sponsors = await prisma.sponsor.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      });
      return res.json({ sponsors });
    } catch (error) {
      console.error('Error al obtener sponsors:', error);
      return res.status(500).json({ error: 'Error al consultar sponsors' });
    }
  }

  static async getAllAdmin(_req: Request, res: Response) {
    try {
      const sponsors = await prisma.sponsor.findMany({
        orderBy: { order: 'asc' },
      });
      return res.json({ sponsors });
    } catch (error) {
      console.error('Error al obtener sponsors (admin):', error);
      return res.status(500).json({ error: 'Error al consultar sponsors' });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const { name, websiteUrl, tier, order, isActive } = req.body;
      if (!req.file) return res.status(400).json({ error: 'Logo requerido' });

      const logoUrl = `/uploads/${req.file.filename}`;
      const sponsor = await prisma.sponsor.create({
        data: {
          name,
          logoUrl,
          websiteUrl,
          tier,
          order: Number(order) || 0,
          isActive: isActive === 'true' || isActive === true,
        },
      });
      return res.status(201).json({ sponsor });
    } catch (error) {
      console.error('Error al crear sponsor:', error);
      return res.status(500).json({ error: 'Error al crear sponsor' });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, websiteUrl, tier, order, isActive } = req.body;
      const data: any = {
        name,
        websiteUrl,
        tier,
        order: Number(order),
        isActive: isActive === 'true' || isActive === true,
      };
      if (req.file) data.logoUrl = `/uploads/${req.file.filename}`;

      const sponsor = await prisma.sponsor.update({ where: { id }, data });
      return res.json({ sponsor });
    } catch (error) {
      console.error('Error al actualizar sponsor:', error);
      return res.status(500).json({ error: 'Error al actualizar sponsor' });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.sponsor.delete({ where: { id } });
      return res.json({ message: 'Sponsor eliminado' });
    } catch (error) {
      console.error('Error al eliminar sponsor:', error);
      return res.status(500).json({ error: 'Error al eliminar sponsor' });
    }
  }
}

