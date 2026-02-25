export interface CategoryOptionModel {
  id: number;
  name: string;
  additionalPrice: number;
  isAvailable: boolean;
}

export class Category {
  id: string;
  name: string;
  discountPercent?: number;
  isActive: boolean;
  type: 'CAFE' | 'RESTAURANT' | 'BREAKFAST';
  iconId?: string | null;
  iconPath?: string | null;
  createdAt: Date;
  updatedAt: Date;
  options?: CategoryOptionModel[];
}
