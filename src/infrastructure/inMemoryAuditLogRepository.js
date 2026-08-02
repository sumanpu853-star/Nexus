export function createInMemoryAuditLogRepository(initialEvents = []) {
  const eventsById = new Map();

  for (const event of initialEvents) {
    saveEvent(event);
  }

  return Object.freeze({
    async findById(id) {
      return cloneOrNull(eventsById.get(id));
    },

    async findAll() {
      return cloneArray([...eventsById.values()]);
    },

    async save(event) {
      saveEvent(event);

      return cloneOrNull(event);
    }
  });

  function saveEvent(event) {
    eventsById.set(event.id, clone(event));
  }
}

function cloneOrNull(value) {
  return value ? clone(value) : null;
}

function cloneArray(values) {
  return values.map((value) => clone(value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
