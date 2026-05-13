# Chronofact 启动说明

本文档记录当前仓库的本地启动方式。首次启动已完成，后续日常使用通常不需要重复创建缓存目录。

## 前置条件

- 已安装并启动 Docker Desktop
- 已安装 Python 3
- 在项目根目录执行命令：

```powershell
cd D:\Courseware\Chronofact
```

## 日常启动

启动 Chronestia 服务：

```powershell
python scripts\compose_smart.py up -d chronestia
```

启动开发工作容器：

```powershell
docker compose up -d workspace
```

查看运行状态：

```powershell
docker compose ps
```

预期结果：

- `chronofact-chronestia` 处于 `Up` 状态
- `chronofact-workspace` 处于 `Up` 状态
- Chronestia 默认映射到本机 `8080` 端口

## 第一阶段整体验证

其他成员第一阶段代码合并后，可在根目录运行：

```powershell
npm run check:phase-one
```

该命令会依次验证：

- 组员 A：Chronofact API 测试
- 组员 D：AI explanation 单元测试
- 组员 C：Solidity 合约编译
- 组员 B：前端 production build
- 整体链路：Chronofact API 调用 AI explanation 服务并完成提交、版本、核验和失败状态 smoke test

## 前后端联调

启动 AI explanation 服务：

```powershell
cd services\ai-explanation
python run_server.py
```

启动 Chronofact API，并让它调用 AI explanation 服务：

```powershell
cd services\chronofact-api
$env:CHRONOFACT_AI_URL="http://127.0.0.1:8000"
npm start
```

如果同时要让 Chronofact API 调用 Docker 暴露的 Chronestia：

```powershell
$env:CHRONOFACT_CHRONESTIA_URL="http://127.0.0.1:8080"
npm start
```

如果要调用 Dualweave 上传服务，还需要提供 Dualweave 的 execution spec：

```powershell
$env:CHRONOFACT_DUALWEAVE_URL="http://127.0.0.1:8081"
$env:CHRONOFACT_DUALWEAVE_EXECUTION_FILE="configs\dualweave.execution.json"
npm start
```

当前 Limora 身份仍使用固定 demo identity，等上传和存证链路稳定后再替换为 Limora HTTP 身份。

启动前端实时联调模式：

```powershell
cd services\frontend-demo
$env:VITE_CHRONOFACT_API_URL="http://127.0.0.1:3001"
npm run dev
```

未设置 `VITE_CHRONOFACT_API_URL` 时，前端仍使用本地 mock contract 场景。

## 进入开发容器

```powershell
docker compose run --rm workspace
```

进入后工作目录为容器内的：

```text
/workspace
```

该目录映射到本机项目根目录。

## 停止服务

停止 Chronestia 和 Compose 服务：

```powershell
python scripts\compose_smart.py down
```

或直接停止全部 Compose 服务：

```powershell
docker compose down --remove-orphans
```

## 首次启动参考

首次启动时已经执行过以下目录初始化；后续一般不需要重复执行：

```powershell
mkdir .cache,tmp -Force
mkdir .cache\chronestia -Force
```

检查 Chronestia 使用模式：

```powershell
python scripts\compose_smart.py status
```

当前默认模式为使用发布镜像：

```text
Chronestia mode: published image
Image source: compose.yaml -> CHRONESTIA_IMAGE
```

## 常见问题

如果 `docker compose ps` 没有容器，通常说明服务尚未启动或 Docker Desktop 未运行。

如果镜像拉取较慢，等待命令完成，不要中途按 `Ctrl+C`。

如果本机 `8080` 端口被占用，可在启动前临时指定端口：

```powershell
$env:CHRONESTIA_PORT="18080"
python scripts\compose_smart.py up -d chronestia
```

## 本地设置说明

本地环境文件和缓存目录不应提交：

- `.cache/`
- `tmp/`
- `configs/chain.env`
- `deployments/artifacts/`
- `deployments/ganache/`

如果你已经对 `compose.yaml` 做了本机适配，保留本地设置即可，不需要提交。
