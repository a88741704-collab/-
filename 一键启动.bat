@echo off
title NovelCraft 启动器

:: 1. 切换到 D 盘
d:

:: 2. 进入你的项目文件夹 (使用了引号以防路径中有空格)
cd "D:\桌面\写作资料ZLY\写作教学\novelcraft-ai-pipeline"

:: 3. 告诉用户正在启动
echo 正在启动写作软件，请稍候...
echo 注意：请不要关闭这个黑色窗口，最小化即可。

:: 4. 执行启动命令
npm run app:dev

