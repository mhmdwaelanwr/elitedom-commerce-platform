import facebook from "@/assets/social/facebook.svg";
import instagram from "@/assets/social/instagram.svg";
import tiktok from "@/assets/social/tiktok.svg";
import x from "@/assets/social/x.svg";
import youtube from "@/assets/social/youtube.svg";
import type { StoreLocale } from "@/components/store/StoreHeader";

const networks = [
  { label: "X", icon: x, href: "#" },
  { label: "Instagram", icon: instagram, href: "#" },
  { label: "Facebook", icon: facebook, href: "#" },
  { label: "YouTube", icon: youtube, href: "#" },
  { label: "TikTok", icon: tiktok, href: "#" },
] as const;

export function SocialDock({ locale }: { locale: StoreLocale }) {
  const labels = locale === "ar"
    ? { region: "روابط Elitedom على السوشيال ميديا", follow: "تابع ELITEDOM" }
    : { region: "Elitedom social links", follow: "FOLLOW ELITEDOM" };
  return (
    <aside aria-label={labels.region} className="el-social-dock">
      <span className="el-social-dock__accent" />
      <span className="el-social-dock__label"><span /> {labels.follow}</span>
      <div className="el-social-dock__items">
        {networks.map((network) => (
          <a aria-label={network.label} href={network.href} key={network.label}>
            <img alt="" aria-hidden="true" src={network.icon} />
          </a>
        ))}
      </div>
    </aside>
  );
}
