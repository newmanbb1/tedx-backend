import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';

export class BackgroundController {
  static async getPublic(_req: Request, res: Response) {
    try {
      const images = await prisma.backgroundImage.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      });
      return res.json({ images });
    } catch (error) {
      console.error('Error al obtener imágenes de fondo:', error);
      return res.status(500).json({ error: 'Error al consultar imágenes de fondo' });
    }
  }

  static async getAllAdmin(_req: Request, res: Response) {
    try {
      const images = await prisma.backgroundImage.findMany({
        orderBy: { order: 'asc' },
      });
      return res.json({ images });
    } catch (error) {
      console.error('Error al obtener imágenes de fondo (admin):', error);
      return res.status(500).json({ error: 'Error al consultar imágenes de fondo' });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const { title, order, isActive } = req.body;
      if (!req.file) return res.status(400).json({ error: 'Imagen requerida' });

      const imageUrl = `/uploads/${req.file.filename}`;
      const bgImage = await prisma.backgroundImage.create({
        data: {
          title,
          imageUrl,
          order: Number(order) || 0,
          isActive: isActive === 'true' || isActive === true,
        },
      });
      return res.status(201).json({ image: bgImage });
    } catch (error) {
      console.error('Error al subir imagen de fondo:', error);
      return res.status(500).json({ error: 'Error al subir imagen de fondo' });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.backgroundImage.delete({ where: { id } });
      return res.json({ message: 'Imagen eliminada exitosamente' });
    } catch (error) {
      console.error('Error al eliminar imagen de fondo:', error);
      return res.status(500).json({ error: 'Error al eliminar imagen' });
    }
  }
}

