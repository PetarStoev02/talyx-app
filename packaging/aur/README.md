# talyx-bin (AUR)

`PKGBUILD` and `.SRCINFO` for [`talyx-bin`](https://aur.archlinux.org/packages/talyx-bin) on the
Arch User Repository. The package repackages the release's `Talyx-amd64.deb`, downloaded from the
GitHub release and pinned by its sha256: the same file as the release, so it adds no new trust
path. The desktop entry, icon and licence come from the deb; the package links `/usr/bin/talyx`
and `/usr/share/licenses/talyx-bin/LICENSE` (AGPL-3.0-only).

**Status: not published yet.** The package exists on the AUR only once the owner has pushed it
(below). Until then `yay -S talyx-bin` finds nothing.

Like the deb, an AUR install does not update itself: the update button opens the release page,
and the AUR package moves to the new release once its PKGBUILD is pushed.

## Each release

The Release workflow runs `bump.sh` on the deb it built and keeps the result as the run's `aur`
artifact (`PKGBUILD` and `.SRCINFO` with the new `pkgver`, `pkgrel=1` and the deb's sha256). It
never pushes to the AUR. After publishing the release:

```bash
gh run download <run id> --repo PetarStoev02/talyx-app --name aur --dir aur-new
cp aur-new/PKGBUILD aur-new/.SRCINFO ~/aur/talyx-bin/
cd ~/aur/talyx-bin && git commit -am "Update to <version>" && git push
```

Also copy them into `packaging/aur/` here in a PR, so the next release bumps from them.

## One-time setup (owner)

1. Create an account at <https://aur.archlinux.org/register>.
2. Make an SSH key for the AUR only, `ssh-keygen -t ed25519 -f ~/.ssh/aur`, and paste
   `~/.ssh/aur.pub` into My Account → SSH Public Key.
3. Add to `~/.ssh/config`:

   ```
   Host aur.archlinux.org
     IdentityFile ~/.ssh/aur
     User aur
   ```

4. First push: cloning a name nobody owns makes an empty repository, and the first push creates
   the package with you as its maintainer.

   ```bash
   git clone ssh://aur@aur.archlinux.org/talyx-bin.git ~/aur/talyx-bin
   cp packaging/aur/PKGBUILD packaging/aur/.SRCINFO ~/aur/talyx-bin/
   cd ~/aur/talyx-bin && git add PKGBUILD .SRCINFO && git commit -m "Initial import" && git push
   ```

5. Then drop "coming soon" for the AUR package in the README's Install section and on the
   website (`website/src/pages/landing/sections/InstallSteps.tsx`), and link the AUR page.

To check a PKGBUILD before pushing, on Arch (or in an `archlinux` container):
`makepkg --printsrcinfo | diff - .SRCINFO && makepkg -f && namcap *.pkg.tar.zst`.

## Flathub: not now

Decided 2026-11-13 (issue #46). Talyx runs the engine CLI from `~/.local/bin`, and first-run setup
installs the engine into the home folder. In the Flatpak sandbox both need host escapes
(`flatpak-spawn --host`, broad home access) that Flathub review pushes back on, and Talyx's
self-update does not apply there. Revisit if users ask.
