import { getSelectedLocation, listLocations } from "@/server/locations";

export type LocationOptionVM = { id: string; name: string; city: string; isSelected: boolean };

export type LocationPickerVM = {
  buttonLabel: string;
  options: LocationOptionVM[];
};

/** Everything the theater picker needs to render. */
export async function getLocationPickerViewModel(): Promise<LocationPickerVM> {
  const all = await listLocations();
  const selected = await getSelectedLocation(all);
  return {
    buttonLabel: selected?.name ?? "Choose a theater",
    options: all.map((l) => ({ ...l, isSelected: l.id === selected?.id })),
  };
}
