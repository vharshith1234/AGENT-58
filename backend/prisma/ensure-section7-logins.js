const { ensureSection7Logins, disconnect } = require('./import-section7');

ensureSection7Logins()
  .then((result) => {
    const rows = result.created || result;
    console.log('\nKept faculty logins (password = Vignan@{8-digit})\n');
    for (const row of rows) {
      if (!row.ok) {
        console.log(`FAIL  ${row.name}  ${row.error}`);
        continue;
      }
      console.log(`${row.email.padEnd(36)}  ${row.password.padEnd(24)}  ${row.name}`);
    }
    if (result.deactivated?.length) {
      console.log('\nDeactivated:\n');
      for (const d of result.deactivated) {
        console.log(`- ${d.name}  (${d.email})`);
      }
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnect();
  });
