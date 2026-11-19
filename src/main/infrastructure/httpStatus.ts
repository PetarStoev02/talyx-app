/** The HTTP status codes main's servers send and its clients read. */
export const HTTP_STATUS = {
  ok: 200,
  accepted: 202,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  methodNotAllowed: 405,
  internalError: 500
} as const
