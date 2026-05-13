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
