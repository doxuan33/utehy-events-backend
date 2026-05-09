import { Response } from 'express';

export const sendSuccess = (res: Response, data: any, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({ success: true, message, data });
};

export const sendError = (res: Response, message: string, statusCode = 400) => {
  res.status(statusCode).json({ success: false, message, data: null });
};