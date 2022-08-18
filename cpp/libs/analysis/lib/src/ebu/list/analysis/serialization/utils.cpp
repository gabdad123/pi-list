#include "ebu/list/analysis/serialization/utils.h"

#include <fstream>
#include <iomanip>

using namespace ebu_list;

void analysis::write_json_to(const path& dir, const std::string& filename, const nlohmann::json& content)
{
    std::experimental::filesystem::create_directories(dir);
    const auto info_path = dir / filename;

    std::ofstream o(info_path.string());
    o << std::setw(4) << content << std::endl;
}

analysis::histogram_writer::histogram_writer(path info_path, std::string_view filename)
    : info_path_(std::move(info_path)), filename_(filename)
{
}

void analysis::histogram_writer::on_data(const histogram_t& histogram)
{
    nlohmann::json j;
    j["histogram"] = histogram;

    write_json_to(info_path_, filename_, j);
}

void analysis::histogram_writer::on_complete()
{
}

void analysis::histogram_writer::on_error(std::exception_ptr)
{
}

pit_writer::pit_writer::pit_writer(path info_path, std::string_view filename)
    : info_path_(std::move(info_path)), filename_(filename)
{
}

void pit_writer::pit_writer::on_data(const st2110::packet_interval_time_analyzer::packet_interval_time_info& pit_info)
{
    nlohmann::json j;
    if(pit_info.data.has_value())
    {
        j["avg"] = pit_info.data->avg;
        j["min"] = pit_info.data->min;
        j["max"] = pit_info.data->max;
    }
    j["total_packets"] = pit_info.packets_count;
    j["histogram"]     = pit_info.histogram;
    j["bucket_width"]  = pit_info.bucket_width;

    write_json_to(info_path_, filename_, j);
}

void pit_writer::pit_writer::on_complete()
{
}

void pit_writer::pit_writer::on_error(std::exception_ptr)
{
}
