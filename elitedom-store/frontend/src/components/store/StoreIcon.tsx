import accountIcon from "@/assets/icons/account.svg";
import arrowIcon from "@/assets/icons/arrow.svg";
import cartIcon from "@/assets/icons/cart.svg";
import compareIcon from "@/assets/icons/compare.svg";
import deliveryIcon from "@/assets/icons/delivery.svg";
import filterIcon from "@/assets/icons/filter.svg";
import menuIcon from "@/assets/icons/menu.svg";
import minusIcon from "@/assets/icons/minus.svg";
import packageIcon from "@/assets/icons/package.svg";
import paymentIcon from "@/assets/icons/payment.svg";
import plusIcon from "@/assets/icons/plus.svg";
import returnsIcon from "@/assets/icons/returns.svg";
import searchIcon from "@/assets/icons/search.svg";
import sortIcon from "@/assets/icons/sort.svg";
import warrantyIcon from "@/assets/icons/warranty.svg";

export type StoreIconName =
  | "account"
  | "arrow"
  | "cart"
  | "compare"
  | "delivery"
  | "filter"
  | "menu"
  | "minus"
  | "package"
  | "payment"
  | "plus"
  | "returns"
  | "search"
  | "sort"
  | "warranty";

const iconByName: Record<StoreIconName, string> = {
  account: accountIcon,
  arrow: arrowIcon,
  cart: cartIcon,
  compare: compareIcon,
  delivery: deliveryIcon,
  filter: filterIcon,
  menu: menuIcon,
  minus: minusIcon,
  package: packageIcon,
  payment: paymentIcon,
  plus: plusIcon,
  returns: returnsIcon,
  search: searchIcon,
  sort: sortIcon,
  warranty: warrantyIcon,
};

type StoreIconProps = {
  name: StoreIconName;
  size?: number;
  className?: string;
};

export function StoreIcon({ name, size = 24, className }: StoreIconProps) {
  return (
    <img
      aria-hidden="true"
      alt=""
      className={className}
      height={size}
      src={iconByName[name]}
      width={size}
    />
  );
}
