import accountIcon from "@/assets/icons/account.svg";
import arrowIcon from "@/assets/icons/arrow.svg";
import bankIcon from "@/assets/icons/bank.svg";
import cartIcon from "@/assets/icons/cart.svg";
import cashIcon from "@/assets/icons/cash.svg";
import checkIcon from "@/assets/icons/check.svg";
import compareIcon from "@/assets/icons/compare.svg";
import deliveryIcon from "@/assets/icons/delivery.svg";
import filterIcon from "@/assets/icons/filter.svg";
import locationIcon from "@/assets/icons/location.svg";
import mailIcon from "@/assets/icons/mail.svg";
import menuIcon from "@/assets/icons/menu.svg";
import minusIcon from "@/assets/icons/minus.svg";
import packageIcon from "@/assets/icons/package.svg";
import paymentIcon from "@/assets/icons/payment.svg";
import phoneIcon from "@/assets/icons/phone.svg";
import plusIcon from "@/assets/icons/plus.svg";
import returnsIcon from "@/assets/icons/returns.svg";
import searchIcon from "@/assets/icons/search.svg";
import sortIcon from "@/assets/icons/sort.svg";
import walletIcon from "@/assets/icons/wallet.svg";
import warrantyIcon from "@/assets/icons/warranty.svg";

export type StoreIconName =
  | "account"
  | "arrow"
  | "bank"
  | "cart"
  | "cash"
  | "check"
  | "compare"
  | "delivery"
  | "filter"
  | "location"
  | "mail"
  | "menu"
  | "minus"
  | "package"
  | "payment"
  | "phone"
  | "plus"
  | "returns"
  | "search"
  | "sort"
  | "wallet"
  | "warranty";

const iconByName: Record<StoreIconName, string> = {
  account: accountIcon,
  arrow: arrowIcon,
  bank: bankIcon,
  cart: cartIcon,
  cash: cashIcon,
  check: checkIcon,
  compare: compareIcon,
  delivery: deliveryIcon,
  filter: filterIcon,
  location: locationIcon,
  mail: mailIcon,
  menu: menuIcon,
  minus: minusIcon,
  package: packageIcon,
  payment: paymentIcon,
  phone: phoneIcon,
  plus: plusIcon,
  returns: returnsIcon,
  search: searchIcon,
  sort: sortIcon,
  wallet: walletIcon,
  warranty: warrantyIcon,
};

type StoreIconProps = {
  name: StoreIconName;
  size?: number;
  className?: string;
};

export function StoreIcon({ name, size = 24, className }: StoreIconProps) {
  return <img aria-hidden="true" alt="" className={className} height={size} src={iconByName[name]} width={size} />;
}
