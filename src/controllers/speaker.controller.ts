import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';

export class SpeakerController {
  static async getPublicSpeakers(_req: Request, res: Response) {
    try {
      const activeEvent = await prisma.event.findFirst({
        where: { isActive: true },
      });

      if (!activeEvent) {
        return res.json({ speakers: [] });
      }

      const speakers = await prisma.speaker.findMany({
        where: {
          eventId: activeEvent.id,
          isActive: true,
        },
        orderBy: { order: 'asc' },
      });

      return res.json({ speakers });
    } catch (error: any) {
      console.error('[SpeakerController.getPublicSpeakers]', error);
      return res.status(500).json({ error: 'Error al obtener los oradores' });
    }
  }

  static async getAllSpeakers(_req: Request, res: Response) {
    try {
      const speakers = await prisma.speaker.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        include: { event: true },
      });

      return res.json({ speakers });
    } catch (error: any) {
      console.error('[SpeakerController.getAllSpeakers]', error);
      return res.status(500).json({ error: 'Error al obtener lista de oradores' });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const { name, role, topic, bio, order = 0, eventId } = req.body;

      if (!name || !role || !topic) {
        return res.status(400).json({ error: 'Nombre, cargo y tema son obligatorios' });
      }

      let imageUrl = req.body.imageUrl || '';
      if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
      }

      if (!imageUrl) {
        imageUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80';
      }

      let targetEventId = eventId;
      if (!targetEventId) {
        const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
        targetEventId = activeEvent?.id;
      }

      if (!targetEventId) {
        return res.status(400).json({ error: 'No se encontró un evento activo al cual asignar el orador' });
      }

      const speaker = await prisma.speaker.create({
        data: {
          eventId: targetEventId,
          name: name.trim(),
          role: role.trim(),
          topic: topic.trim(),
          bio: bio?.trim() || null,
          imageUrl,
          order: Number(order) || 0,
          isActive: true,
        },
      });

      return res.status(201).json({ message: 'Orador creado exitosamente', speaker });
    } catch (error: any) {
      console.error('[SpeakerController.create]', error);
      return res.status(500).json({ error: 'Error al crear el orador' });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, role, topic, bio, order, isActive } = req.body;

      const speaker = await prisma.speaker.findUnique({ where: { id } });
      if (!speaker) {
        return res.status(404).json({ error: 'Orador no encontrado' });
      }

      let imageUrl = speaker.imageUrl;
      if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
      } else if (req.body.imageUrl) {
        imageUrl = req.body.imageUrl;
      }

      const updated = await prisma.speaker.update({
        where: { id },
        data: {
          name: name !== undefined ? name.trim() : speaker.name,
          role: role !== undefined ? role.trim() : speaker.role,
          topic: topic !== undefined ? topic.trim() : speaker.topic,
          bio: bio !== undefined ? (bio ? bio.trim() : null) : speaker.bio,
          imageUrl,
          order: order !== undefined ? Number(order) : speaker.order,
          isActive: isActive !== undefined ? Boolean(isActive) : speaker.isActive,
        },
      });

      return res.json({ message: 'Orador actualizado exitosamente', speaker: updated });
    } catch (error: any) {
      console.error('[SpeakerController.update]', error);
      return res.status(500).json({ error: 'Error al actualizar el orador' });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.speaker.delete({ where: { id } });
      return res.json({ message: 'Orador eliminado exitosamente' });
    } catch (error: any) {
      console.error('[SpeakerController.delete]', error);
      return res.status(500).json({ error: 'Error al eliminar el orador' });
    }
  }
}

