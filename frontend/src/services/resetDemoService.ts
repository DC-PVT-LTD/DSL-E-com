import { productService } from './productService';
import { categoryService } from './categoryService';
import { orderService } from './orderService';
import { schoolPackService } from './schoolPackService';
import { useCartStore } from './cartStore';
import { useUserStore } from './userStore';
import { INITIAL_CUSTOMERS } from '@/mocks/customers';

export function resetAllDemoData() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('dsl_products_data_v1');
    localStorage.removeItem('dsl_categories_data_v1');
    localStorage.removeItem('dsl_brands_data_v1');
    localStorage.removeItem('dsl_inventory_movements_v1');
    localStorage.removeItem('dsl_orders_data_v1');
    localStorage.removeItem('dsl_school_packs_v1');
    localStorage.removeItem('dsl_uploaded_lists_v1');
    localStorage.removeItem('dsl_cart_v1');
    localStorage.removeItem('dsl_user_v1');
  }

  productService.resetToDefault();
  categoryService.resetToDefault();
  orderService.resetToDefault();
  schoolPackService.resetToDefault();
  useCartStore.getState().clearCart();
  useUserStore.setState({
    currentUser: INITIAL_CUSTOMERS[0],
    isAdminLoggedIn: true,
    adminEmail: 'admin@dslstationery.lk',
  });
}
