const queues = new Map();

function enqueueGameAction(gameId, action) {
  const previous = queues.get(gameId) || Promise.resolve();
  const current = previous.catch(() => {}).then(action);
  queues.set(gameId, current);
  return current.finally(() => {
    if (queues.get(gameId) === current) queues.delete(gameId);
  });
}

module.exports = { enqueueGameAction };
