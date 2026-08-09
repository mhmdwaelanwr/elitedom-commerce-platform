import accountIcon from "@/assets/icons/account.svg";
import arrowIcon from "@/assets/icons/arrow.svg";
import bankIcon from "@/assets/icons/bank.svg";
import briefcaseIcon from "@/assets/icons/briefcase.svg";
import buildingIcon from "@/assets/icons/building.svg";
import cartIcon from "@/assets/icons/cart.svg";
import cashIcon from "@/assets/icons/cash.svg";
import checkIcon from "@/assets/icons/check.svg";
import chevronIcon from "@/assets/icons/chevron.svg";
import clipboardIcon from "@/assets/icons/clipboard.svg";
import clockIcon from "@/assets/icons/clock.svg";
import compareIcon from "@/assets/icons/compare.svg";
import deliveryIcon from "@/assets/icons/delivery.svg";
import editIcon from "@/assets/icons/edit.svg";
import eyeIcon from "@/assets/icons/eye.svg";
import fileIcon from "@/assets/icons/file.svg";
import filterIcon from "@/assets/icons/filter.svg";
import heartIcon from "@/assets/icons/heart.svg";
import historyIcon from "@/assets/icons/history.svg";
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
import plugIcon from "@/assets/icons/plug.svg";
import plusIcon from "@/assets/icons/plus.svg";
import returnsIcon from "@/assets/icons/returns.svg";
import rocketIcon from "@/assets/icons/rocket.svg";
import searchIcon from "@/assets/icons/search.svg";
import shieldIcon from "@/assets/icons/shield.svg";
import sortIcon from "@/assets/icons/sort.svg";
import starIcon from "@/assets/icons/star.svg";
import sunIcon from "@/assets/icons/sun.svg";
import usersIcon from "@/assets/icons/users.svg";
import walletIcon from "@/assets/icons/wallet.svg";
import warehouseIcon from "@/assets/icons/warehouse.svg";
import warrantyIcon from "@/assets/icons/warranty.svg";

export type StoreIconName =
  | "account"
  | "arrow"
  | "bank"
  | "briefcase"
  | "building"
  | "cart"
  | "cash"
  | "check"
  | "chevron"
  | "clipboard"
  | "clock"
  | "compare"
  | "delivery"
  | "edit"
  | "eye"
  | "file"
  | "filter"
  | "heart"
  | "history"
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
  | "plug"
  | "plus"
  | "returns"
  | "rocket"
  | "search"
  | "shield"
  | "sort"
  | "star"
  | "sun"
  | "users"
  | "wallet"
  | "warehouse"
  | "warranty";

const iconByName: Record<StoreIconName, string> = {
  account: accountIcon,
  arrow: arrowIcon,
  bank: bankIcon,
  briefcase: briefcaseIcon,
  building: buildingIcon,
  cart: cartIcon,
  cash: cashIcon,
  check: checkIcon,
  chevron: chevronIcon,
  clipboard: clipboardIcon,
  clock: clockIcon,
  compare: compareIcon,
  delivery: deliveryIcon,
  edit: editIcon,
  eye: eyeIcon,
  file: fileIcon,
  filter: filterIcon,
  heart: heartIcon,
  history: historyIcon,
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
  plug: plugIcon,
  plus: plusIcon,
  returns: returnsIcon,
  rocket: rocketIcon,
  search: searchIcon,
  shield: shieldIcon,
  sort: sortIcon,
  star: starIcon,
  sun: sunIcon,
  users: usersIcon,
  wallet: walletIcon,
  warehouse: warehouseIcon,
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
