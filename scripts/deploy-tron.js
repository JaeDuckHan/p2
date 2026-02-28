/**
 * MiniSwapEscrow Tron 배포 스크립트
 *
 * Tron은 EVM과 호환되는 TVM을 사용하므로,
 * Hardhat으로 컴파일한 ABI/Bytecode를 TronWeb으로 배포합니다.
 *
 * 사용법:
 *   TRON_NETWORK=nile node scripts/deploy-tron.js      (테스트넷)
 *   TRON_NETWORK=mainnet node scripts/deploy-tron.js   (메인넷)
 *
 * 필수 환경변수:
 *   TRON_PRIVATE_KEY   — Tron 배포자 개인키 (hex)
 *   TRON_NETWORK       — 'nile' (테스트넷) 또는 'mainnet'
 */
const fs   = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

// TronWeb 동적 import (ESM 모듈)
async function main() {
  // ── 환경변수 확인 ─────────────────────────────────────────────
  const privateKey = process.env.TRON_PRIVATE_KEY
  if (!privateKey) {
    console.error('ERROR: TRON_PRIVATE_KEY 환경변수를 설정하세요')
    process.exit(1)
  }

  const network = process.env.TRON_NETWORK || 'nile'

  const networkConfig = {
    nile: {
      fullHost: 'https://nile.trongrid.io',
      usdtAddress: null,  // 테스트넷: MockERC20 배포
    },
    mainnet: {
      fullHost: 'https://api.trongrid.io',
      usdtAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',  // TRC20 USDT
    },
  }

  const config = networkConfig[network]
  if (!config) {
    console.error(`ERROR: 지원하지 않는 네트워크: ${network} (nile 또는 mainnet)`)
    process.exit(1)
  }

  // ── TronWeb 초기화 ────────────────────────────────────────────
  const TronWeb = require('tronweb').default || require('tronweb')
  const tronWeb = new TronWeb({
    fullHost: config.fullHost,
    privateKey: privateKey,
  })

  const deployerAddress = tronWeb.address.fromPrivateKey(privateKey)
  console.log('────────────────────────────────────────')
  console.log('Network  :', network)
  console.log('Deployer :', deployerAddress)
  console.log('────────────────────────────────────────')

  // ── Hardhat 아티팩트 로드 ─────────────────────────────────────
  const artifactPath = path.join(ROOT, 'artifacts/contracts/MiniSwapEscrow.sol/MiniSwapEscrow.json')
  if (!fs.existsSync(artifactPath)) {
    console.error('ERROR: 먼저 npx hardhat compile 을 실행하여 아티팩트를 생성하세요')
    process.exit(1)
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
  const { abi, bytecode } = artifact

  // ── USDT 주소 결정 ────────────────────────────────────────────
  let usdtAddress = config.usdtAddress

  if (!usdtAddress) {
    // 테스트넷: MockERC20 배포
    console.log('\n[1/3] Deploying MockERC20 (USDT) on Tron testnet...')

    const mockArtifactPath = path.join(ROOT, 'artifacts/contracts/test/MockERC20.sol/MockERC20.json')
    if (!fs.existsSync(mockArtifactPath)) {
      console.error('ERROR: MockERC20 아티팩트가 없습니다. npx hardhat compile 실행 필요')
      process.exit(1)
    }

    const mockArtifact = JSON.parse(fs.readFileSync(mockArtifactPath, 'utf8'))

    const mockTx = await tronWeb.transactionBuilder.createSmartContract({
      abi: mockArtifact.abi,
      bytecode: mockArtifact.bytecode,
      feeLimit: 1000000000,  // 1000 TRX
      callValue: 0,
      parameters: ['Tether USD', 'USDT', 6],
    }, deployerAddress)

    const signedMock = await tronWeb.trx.sign(mockTx, privateKey)
    const resultMock = await tronWeb.trx.sendRawTransaction(signedMock)

    if (!resultMock.result) {
      console.error('MockERC20 배포 실패:', resultMock)
      process.exit(1)
    }

    // 트랜잭션 확인 대기
    console.log('     Waiting for confirmation...')
    await sleep(5000)

    const txInfo = await tronWeb.trx.getTransactionInfo(resultMock.txid)
    usdtAddress = tronWeb.address.fromHex(txInfo.contract_address)
    console.log('     MockUSDT:', usdtAddress)

    // 테스트용 USDT 민팅
    const mockContract = await tronWeb.contract(mockArtifact.abi, usdtAddress)
    await mockContract.mint(deployerAddress, '100000000000').send({ feeLimit: 100000000 })
    console.log('     Minted 100,000 USDT to deployer')
  } else {
    console.log('\n[1/3] Using Tron mainnet USDT:', usdtAddress)
  }

  // ── MiniSwapEscrow 배포 ───────────────────────────────────────
  console.log('\n[2/3] Deploying MiniSwapEscrow on Tron...')

  // Tron에서는 feeRecipient, admin1, admin2, relayer를 모두 배포자로 설정
  // (실제 운영 시 별도 주소 사용)
  const feeRecipient = process.env.TRON_FEE_RECIPIENT || deployerAddress
  const admin1       = process.env.TRON_ADMIN1 || deployerAddress
  const admin2       = process.env.TRON_ADMIN2 || deployerAddress
  const relayer      = process.env.TRON_RELAYER || deployerAddress

  const escrowTx = await tronWeb.transactionBuilder.createSmartContract({
    abi: abi,
    bytecode: bytecode,
    feeLimit: 1500000000,  // 1500 TRX
    callValue: 0,
    parameters: [
      tronWeb.address.toHex(usdtAddress),
      tronWeb.address.toHex(feeRecipient),
      tronWeb.address.toHex(admin1),
      tronWeb.address.toHex(admin2),
      tronWeb.address.toHex(relayer),
    ],
  }, deployerAddress)

  const signedEscrow = await tronWeb.trx.sign(escrowTx, privateKey)
  const resultEscrow = await tronWeb.trx.sendRawTransaction(signedEscrow)

  if (!resultEscrow.result) {
    console.error('MiniSwapEscrow 배포 실패:', resultEscrow)
    process.exit(1)
  }

  console.log('     Waiting for confirmation...')
  await sleep(5000)

  const escrowInfo = await tronWeb.trx.getTransactionInfo(resultEscrow.txid)
  const escrowAddress = tronWeb.address.fromHex(escrowInfo.contract_address)
  console.log('     MiniSwapEscrow:', escrowAddress)

  // ── deployments.js 업데이트 ───────────────────────────────────
  console.log('\n[3/3] Saving deployment info to src/deployments.js...')
  const deploymentsPath = path.join(ROOT, 'src', 'deployments.js')

  let existing = {}
  if (fs.existsSync(deploymentsPath)) {
    const content = fs.readFileSync(deploymentsPath, 'utf8')
    const m = content.match(/export const DEPLOYMENTS\s*=\s*(\{[\s\S]*?\});/)
    if (m) {
      try { existing = JSON.parse(m[1]) } catch {}
    }
  }

  existing['tron'] = { escrow: escrowAddress, usdt: usdtAddress }

  const newContent =
    `// Auto-generated by scripts/deploy.js — do not edit manually\n` +
    `export const DEPLOYMENTS = ${JSON.stringify(existing, null, 2)};\n`

  fs.writeFileSync(deploymentsPath, newContent, 'utf8')
  console.log('     Saved!')

  console.log('\n────────────────────────────────────────')
  console.log('Done! Tron Contract addresses:')
  console.log('  USDT  :', usdtAddress)
  console.log('  Escrow:', escrowAddress)
  console.log('────────────────────────────────────────')
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
