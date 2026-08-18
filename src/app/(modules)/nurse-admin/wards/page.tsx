// Floors, Wards & Beds — mounted for Nurse Admin.
//
// nurse_admin already holds full floors / wards / beds permissions; the only
// screen for managing them lived under /hospital/settings/rooms, inside a
// module that role cannot enter. So the permission was real and the page was
// unreachable. This mounts the same screen in the nursing module rather than
// forking a second one — the two must never drift apart, and the page adapts
// its back button to whichever module it was opened from.
export { default } from '@/app/(modules)/hospital/settings/rooms/page';
