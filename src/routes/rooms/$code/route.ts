import { defineRoute, stringParam } from '@loozo/angular-router';

export default defineRoute('rooms/$code', { params: { code: stringParam } });
