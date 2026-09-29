cask "chunkcleaner" do
  version "__VERSION__"
  sha256 "__SHA256__"

  url "https://github.com/akinsibay/chunk-cleaner/releases/download/v#{version}/ChunkCleaner-#{version}-universal.dmg"
  name "ChunkCleaner"
  desc "Find regenerable dependency and build folders and move them to the Trash"
  homepage "https://github.com/akinsibay/chunk-cleaner"

  depends_on macos: ">= :ventura"

  app "ChunkCleaner.app"

  # The app is ad-hoc signed (no Apple Developer ID), so clear the quarantine flag
  # to skip the Gatekeeper "Open Anyway" step.
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "#{appdir}/ChunkCleaner.app"]
  end

  uninstall quit: "com.akin.chunkcleaner"

  zap trash: [
    "~/Library/Application Support/ChunkCleaner",
    "~/Library/Preferences/com.akin.chunkcleaner.plist",
    "~/Library/Saved Application State/com.akin.chunkcleaner.savedState",
  ]
end
