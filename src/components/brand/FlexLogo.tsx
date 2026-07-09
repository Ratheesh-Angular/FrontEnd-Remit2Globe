import Image from "next/image";
import { cn } from "@/lib/utils";
import FlexLogoImage from "../../../assets/images/Flex Logo.png";

type FlexLogoProps = {
  className?: string;
  priority?: boolean;
};

/** Flex Money Transfer wordmark — height-based sizing keeps the wide logo proportional. */
export function FlexLogo({ className, priority = false }: FlexLogoProps) {
  return (
    <Image
      src={FlexLogoImage}
      alt="Flex Money Transfer"
      priority={priority}
      className={cn(
        "h-9 w-auto max-w-[10.5rem] object-contain",
        className,
      )}
    />
  );
}
