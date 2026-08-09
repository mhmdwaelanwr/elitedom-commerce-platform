import accountIcon from "@/assets/icons/account.svg";
import arrowIcon from "@/assets/icons/arrow.svg";
import cartIcon from "@/assets/icons/cart.svg";
import deliveryIcon from "@/assets/icons/delivery.svg";
import menuIcon from "@/assets/icons/menu.svg";
import packageIcon from "@/assets/icons/package.svg";
import paymentIcon from "@/assets/icons/payment.svg";
import searchIcon from "@/assets/icons/search.svg";
import warrantyIcon from "@/assets/icons/warranty.svg";

export type StoreIconName =
  | "account"
  | "arrow"
  | "cart"
  | "delivery"
  | "menu"
  | "package"
  | "payment"
  | "search"
  | "warranty";

const iconByName: Record<StoreIconName, string> = {
  account: accountIcon,
  arrow: arrowIcon,
  cart: cartIcon,
  delivery: deliveryIcon,
  menu: menuIcon,
  package: packageIcon,
  payment: paymentIcon,
  search: searchIcon,
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
