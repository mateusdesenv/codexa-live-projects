export function notFoundHandler(req, res) {
  res.status(404).json({
    ok: false,
    error: `Rota não encontrada: ${req.method} ${req.originalUrl}`
  });
}

export function errorHandler(error, _req, res, _next) {
  const status = error.status || 500;

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    ok: false,
    error: error.message || 'Erro interno da API'
  });
}
