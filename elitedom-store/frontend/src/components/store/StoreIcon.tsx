import accountIcon from "@/assets/icons/account.svg";
import arrowIcon from "@/assets/icons/arrow.svg";
import bankIcon from "@/assets/icons/bank.svg";
import cartIcon from "@/assets/icons/cart.svg";
import cashIcon from "@/assets/icons/cash.svg";
import checkIcon from "@/assets/icons/check.svg";
import chevronIcon from "@/assets/icons/chevron.svg";
import clipboardIcon from "@/assets/icons/clipboard.svg";
import clockIcon from "@/assets/icons/clock.svg";
import compareIcon from "@/assets/icons/compare.svg";
import deliveryIcon from "@/assets/icons/delivery.svg";
import eyeIcon from "@/assets/icons/eye.svg";
import filterIcon from "@/assets/icons/filter.svg";
import heartIcon from "@/assets/icons/heart.svg";
import homeIcon from "@/assets/icons/home.svg";
import locationIcon from "@/assets/icons/location.svg";
import lockIcon from "@/assets/icons/lock.svg";
import mailIcon from "@/assets/icons/mail.svg";
import menuIcon from "@/assets/icons/menu.svg";
import minusIcon from "@/assets/icons/minus.svg";
import moonIcon from "@/assets/icons/moon.svg";
import packageIcon from "@/assets/icons/package.svg";
import paymentIcon from "@/assets/icons/payment.svg";
import phoneIcon from "@/assets/icons/phone.svg";
import plusIcon from "@/assets/icons/plus.svg";
import returnsIcon from "@/assets/icons/returns.svg";
import searchIcon from "@/assets/icons/search.svg";
import shieldIcon from "@/assets/icons/shield.svg";
import sortIcon from "@/assets/icons/sort.svg";
import starIcon from "@/assets/icons/star.svg";
import sunIcon from "@/assets/icons/sun.svg";
import walletIcon from "@/assets/icons/wallet.svg";
import warrantyIcon from "@/assets/icons/warranty.svg";

export type StoreIconName =
  | "account"
  | "arrow"
  | "bank"
  | "cart"
  | "cash"
  | "check"
  | "chevron"
  | "clipboard"
  | "clock"
  | "compare"
  | "delivery"
  | "eye"
  | "filter"
  | "heart"
  | "home"
  | "location"
  | "lock"
  | "mail"
  | "menu"
  | "minus"
  | "moon"
  | "package"
  | "payment"
  | "phone"
  | "plus"
  | "returns"
  | "search"
  | "shield"
  | "sort"
  | "star"
  | "sun"
  | "wallet"
  | "warranty";

const iconByName: Record<StoreIconName, string> = {
  account: accountIcon,
  arrow: arrowIcon,
  bank: bankIcon,
  cart: cartIcon,
  cash: cashIcon,
  check: checkIcon,
  chevron: chevronIcon,
  clipboard: clipboardIcon,
  clock: clockIcon,
  compare: compareIcon,
  delivery: deliveryIcon,
  eye: eyeIcon,
  filter: filterIcon,
  heart: heartIcon,
  home: homeIcon,
  location: locationIcon,
  lock: lockIcon,
  mail: mailIcon,
  menu: menuIcon,
  minus: minusIcon,
  moon: moonIcon,
  package: packageIcon,
  payment: paymentIcon,
  phone: phoneIcon,
  plus: plusIcon,
  returns: returnsIcon,
  search: searchIcon,
  shield: shieldIcon,
  sort: sortIcon,
  star: starIcon,
  sun: sunIcon,
  wallet: walletIcon,
  warranty: warrantyIcon,
};

type StoreIconProps = {
  name: StoreIconName;
  size?: number;
  className?: string;
};

export function StoreIcon({ name, size = 24, className }: StoreIconProps) {
  return <img aria-hidden="true" alt="" className={["el-store-icon", className ?? ""].filter(Boolean).join(" ")} height={size} src={iconByName[name]} width={size} />;
}
