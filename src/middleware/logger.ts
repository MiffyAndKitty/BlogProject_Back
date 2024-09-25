import morgan from 'morgan';

morgan.token('date', (req, res) => {
  const date = new Date();
  date.setHours(date.getHours() + 9);
  return date.toISOString();
});

export const logger = morgan(
  ':date :method :url :status :response-time ms - :res[content-length]'
);
