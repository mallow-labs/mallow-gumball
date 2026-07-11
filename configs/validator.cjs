const path = require("path");

const programDir = path.join(__dirname, "..", "programs");

function getProgram(programName) {
	return path.join(programDir, ".bin", programName);
}

module.exports = {
	validator: {
		commitment: "processed",
		accountsCluster: "https://api.devnet.solana.com",
		programs: [
			{
				label: "Mallow Gumball",
				programId: "MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa",
				deployPath: getProgram("mallow_gumball.so"),
			},
			{
				label: "Token Metadata",
				programId: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
				deployPath: getProgram("mpl_token_metadata.so"),
			},
			{
				label: "Token Auth Rules",
				programId: "auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg",
				deployPath: getProgram("mpl_token_auth_rules.so"),
			},
			{
				label: "System Extras",
				programId: "SysExL2WDyJi9aRZrXorrjHJut3JwHQ7R9bTyctbNNG",
				deployPath: getProgram("mpl_system_extras.so"),
			},
			{
				label: "Token Extras",
				programId: "TokExjvjJmhKaRBShsBAsbSvEWMA1AgUNK7ps4SAc2p",
				deployPath: getProgram("mpl_token_extras.so"),
			},
			{
				label: "Civic Gateway",
				programId: "gatem74V238djXdzWnJf94Wo1DcnuGkfijbf3AuBhfs",
				deployPath: getProgram("civic_gateway.so"),
			},
			{
				label: "SPL Token 2022",
				programId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
				deployPath: getProgram("spl_token_2022.so"),
			},
			{
				label: "MPL Core",
				programId: "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d",
				deployPath: getProgram("mpl_core.so"),
			},
			{
				label: "MPL Bubblegum",
				programId: "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY",
				deployPath: getProgram("mpl_bubblegum.so"),
			},
			{
				label: "SPL Account Compression",
				programId: "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK",
				deployPath: getProgram("spl_account_compression.so"),
			},
			{
				label: "SPL Noop",
				programId: "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV",
				deployPath: getProgram("spl_noop.so"),
			},
		],
		accounts: [
			{
				label: "Metaplex Default RuleSet",
				accountId: "eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9",
				executable: false,
			},
			// Gumball Guard is loaded as an upgradeable program (not via
			// `--bpf-program`) so that `create_global_config`'s upgrade-authority
			// gate can be exercised. The `executable` entry auto-loads the derived
			// ProgramData account from `.amman/accounts/`. Regenerate both fixtures
			// with `pnpm generate:guard-fixtures` after rebuilding the program.
			{
				label: "Gumball Guard",
				accountId: "GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF",
				executable: true,
			},
		],
	},
};
