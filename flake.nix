{
  description = "flake for twin stack";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-23.05-darwin";
  outputs = { self, nixpkgs }: {
    devShell.aarch64-darwin = nixpkgs.legacyPackages.aarch64-darwin.mkShell {
      buildInputs = with nixpkgs.legacyPackages.aarch64-darwin; [
        nodejs_18
      ];

    shellHook = ''
      started nodejs_18...
      '';
    };
  };
}