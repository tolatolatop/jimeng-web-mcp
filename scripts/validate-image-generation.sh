#!/bin/bash

# 图像生成功能验证脚本
# 用于手动执行验证测试

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 显示帮助信息
show_help() {
    echo "图像生成功能验证脚本"
    echo ""
    echo "用法:"
    echo "  ./scripts/validate-image-generation.sh [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help              显示帮助信息"
    echo "  -a, --all               运行所有测试（默认）"
    echo "  -b, --basic             只运行基础功能测试"
    echo "  -e, --edge              只运行边界条件测试"
    echo "  -p, --performance       只运行性能测试"
    echo "  -t, --token TOKEN       指定API token"
    echo ""
    echo "示例:"
    echo "  ./scripts/validate-image-generation.sh --basic"
    echo "  ./scripts/validate-image-generation.sh --token your_token_here"
    echo ""
}

# 检查环境
check_environment() {
    print_info "检查测试环境..."

    # 检查Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装"
        exit 1
    fi
    print_success "Node.js 版本: $(node --version)"

    # 检查npm
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装"
        exit 1
    fi
    print_success "npm 版本: $(npm --version)"

    # 检查项目依赖
    if [ ! -d "node_modules" ]; then
        print_warning "未找到 node_modules，正在安装依赖..."
        npm install
    fi

    # 检查API token
    if [ -z "$JIMENG_API_TOKEN" ]; then
        print_warning "JIMENG_API_TOKEN 环境变量未设置"
        print_info "请设置API token:"
        print_info "  export JIMENG_API_TOKEN=your_token_here"
        print_info "或使用 -t 参数:"
        print_info "  ./scripts/validate-image-generation.sh -t your_token_here"
        exit 1
    fi
    print_success "API token 已配置"
}

# 运行测试
run_tests() {
    local test_pattern=$1
    local test_name=$2

    print_info "开始运行 ${test_name}..."
    echo ""

    # 运行Jest测试
    if npm test -- tests/manual/image-generation-validation.test.ts $test_pattern --verbose; then
        print_success "${test_name} 完成"
    else
        print_error "${test_name} 失败"
        return 1
    fi

    echo ""
}

# 生成测试报告
generate_report() {
    print_info "生成测试报告..."

    local results_file="specs/20250103-image-validation/results.json"

    if [ -f "$results_file" ]; then
        print_success "测试结果已保存到: $results_file"

        # 统计测试结果
        local total=$(jq 'length' "$results_file")
        local passed=$(jq '[.[] | select(.status == "pass")] | length' "$results_file")
        local failed=$(jq '[.[] | select(.status == "fail")] | length' "$results_file")

        echo ""
        print_info "📊 测试统计:"
        echo "  总用例数: $total"
        echo "  通过: $passed"
        echo "  失败: $failed"
        echo "  通过率: $(( passed * 100 / total ))%"
        echo ""

        # 如果有失败用例，显示详情
        if [ "$failed" -gt 0 ]; then
            print_warning "失败的测试用例:"
            jq -r '.[] | select(.status == "fail") | "  - \(.testId): \(.error)"' "$results_file"
            echo ""
        fi
    else
        print_warning "未找到测试结果文件"
    fi
}

# 打开结果目录
open_results() {
    local results_dir="specs/20250103-image-validation"

    if [ -d "$results_dir" ]; then
        print_info "测试结果目录: $results_dir"

        # 在macOS上自动打开目录
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open "$results_dir"
        fi
    fi
}

# 主函数
main() {
    local mode="all"
    local custom_token=""

    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -a|--all)
                mode="all"
                shift
                ;;
            -b|--basic)
                mode="basic"
                shift
                ;;
            -e|--edge)
                mode="edge"
                shift
                ;;
            -p|--performance)
                mode="performance"
                shift
                ;;
            -t|--token)
                custom_token="$2"
                shift 2
                ;;
            *)
                print_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # 设置API token
    if [ -n "$custom_token" ]; then
        export JIMENG_API_TOKEN="$custom_token"
    fi

    # 显示标题
    echo "================================================"
    echo "   图像生成功能验证测试"
    echo "   jimeng-web-mcp v2.0.2"
    echo "================================================"
    echo ""

    # 检查环境
    check_environment

    echo ""
    print_info "测试模式: $mode"
    echo ""

    # 确认执行
    read -p "确认开始测试？这将消耗API积分。(y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "测试已取消"
        exit 0
    fi

    # 记录开始时间
    local start_time=$(date +%s)

    # 根据模式运行测试
    case $mode in
        all)
            run_tests "" "所有测试"
            ;;
        basic)
            run_tests "-t '阶段1'" "基础功能测试"
            ;;
        edge)
            run_tests "-t '阶段2'" "边界条件和异常测试"
            ;;
        performance)
            run_tests "-t '阶段3'" "性能测试"
            ;;
    esac

    # 记录结束时间
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    print_info "测试总耗时: ${duration}秒"
    echo ""

    # 生成报告
    generate_report

    # 打开结果目录
    open_results

    echo ""
    print_success "验证测试完成！"
    print_info "详细结果请查看:"
    print_info "  - 测试用例: specs/20250103-image-validation/test-cases.md"
    print_info "  - 测试结果: specs/20250103-image-validation/test-results.md"
    print_info "  - 原始数据: specs/20250103-image-validation/results.json"
    echo ""
}

# 执行主函数
main "$@"
