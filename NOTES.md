# Notes

## Race condition

Responses are stored in the cache, keyed by query + variables. `useQuery` renders the cache entry for the variables it has right now.

If you type `SN-1`, then `SN-12`, and `SN-1` comes back last, it goes intov the `SN-1` entry while the list renders `SN-12`. Same for clicking device A then B, and components don't have to handle any of it.

And while keys don't help when two requests have the same variables (a retry, or the refetch after a lock), starting a new request aborts the previous one for that entry. Also a response is only saved if it came from the latest request.

## Tenant

`useTenantQuery` / `useTenantMutation` read `tenantId` from context and spread it in last. I used context, not a module variable, because the latter can change without React noticing, and then the switcher could say beta while the list still shows alpha.

When switching, `setTenantId` drops the previous tenant's cache entries and aborts their requests, and `App` remounts `<ConsoleForTenant key={tenantId}>`. That clears the old rows and the selected device too.

In production `TenantProvider` would probably take `tenantId` from the signed-in user's Amplify/Cognito session instead of the switcher. Nothing below the provider would change.

Nothing renders tenant data outside `<ConsoleForTenant>` today. The hook itself doesn't know about tenants, so a component added outside it would show the old tenant's rows until its new request finished.

## TTL

I've set TTL to 30s, but tbh anything from 15s to a minute would be fine (unless real life usage shows otherwise). A lock patches the cache directly, so the TTL only covers other operators' changes. Opening a device and gonig back to the list should hit the cache, and another operator lock shouldn't stay hidden for minutes. Expired entries refetch on the next read so there's no timer.

## Optimistic lock

The lock add a patch for that device via `addOptimisticLayer`. The cache applies it whenever the list or the detail panel reads the device, so both show LOCKED straight away. If the request succeeds, `LOCKED` is written into the real cached data and teh patch is dropped, and only that device's detail and history are refetched. If it fails, `LockAction` removes the patch and the real data shows again.

I didn't keep a sved copy to roll back to, because putting it back would throw away a refetch that landed while the lock was in flight. An override map in a parent would also work, but every component showing device state would have to apply it.

Invalidating by entity instead wolud need an index from device id to the cache entries that contain it, which is the start of normalisation... :)

## Partial data + errors

`SN-0000-POISON` comes back with data and two errors. The panel shows the data, with "Unavailable" next to `imsi` and `policy`, and only goes blank when there's no data at all.

## Setup

- MSW is pinned to 2.x because the handlers don't load on 3.x.
- `handlers.ts` has `// @ts-nocheck` added, because tsc was throwing errors. That's my only change to the mock


## What's left to do

- A rollback test maybe?
- A way to trigger a failed lock from the UI. Lock isn't offered on LOCKED devices, and that's the only case the mock rejects.
- Aborting a search request once the user has typed past it
- After a lock, marking filtered pages like "ACTIVE" stale

