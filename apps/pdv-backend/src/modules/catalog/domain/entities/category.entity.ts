export interface CategoryProps {
  id: string;
  name: string;
  parentCategoryId: string | null;
}

export class Category {
  readonly id: string;
  readonly name: string;
  readonly parentCategoryId: string | null;

  constructor(props: CategoryProps) {
    this.id = props.id;
    this.name = props.name;
    this.parentCategoryId = props.parentCategoryId;
  }
}
