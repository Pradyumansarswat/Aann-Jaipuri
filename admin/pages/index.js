import { createMediaControls } from '../components/media-controls.js';
import { createDashboardPages } from './dashboard.js';
import { createProductPages } from './products.js';
import { createTrashPages } from './trash.js';
import { createCataloguePages } from './catalogue.js';
import { createUserPages } from './users.js';
import { createCategoryPages } from './categories.js';
import { createContentPages } from './content.js';
import { createEnquiryPages } from './enquiries.js';
import { createMediaPages } from './media.js';
import { createAccountPages } from './account.js';

export function createAdminPages(context) {
  const mediaControls = createMediaControls(context);
  return {
    ...createDashboardPages(context),
    ...createProductPages(context, mediaControls),
    ...createTrashPages(context),
    ...createCataloguePages(context),
    ...createUserPages(context),
    ...createCategoryPages(context, mediaControls),
    ...createContentPages(context, mediaControls),
    ...createEnquiryPages(context),
    ...createMediaPages(context, mediaControls),
    ...createAccountPages(context),
  };
}
