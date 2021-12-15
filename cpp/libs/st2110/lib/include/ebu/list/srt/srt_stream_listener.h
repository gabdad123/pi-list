#pragma once

#include "ebu/list/analysis/serialization/serializable_stream_info.h"
#include "ebu/list/net/udp/listener.h"
#include "ebu/list/srt/srt_format_detector.h"
#include "ebu/list/st2110/format_detector.h"

namespace ebu_list::srt
{
    class srt_stream_listener : public udp::listener
    {
      public:
        explicit srt_stream_listener(udp::datagram& datagram, std::string_view pcap_id);

#pragma region udp::listener events
        void on_data(udp::datagram&& datagram) override;
        void on_complete() override;
        void on_error(std::exception_ptr e) override;
#pragma endregion udp::listener events

        st2110::detector::status_description status() const noexcept;
        nlohmann::json get_info() const;

      private:
        analysis::serializable_stream_info stream_id_;
        srt_format_detector detector_;
        st2110::detector::status_description status_description_ =
            st2110::detector::status_description{/*.state=*/st2110::detector::state::detecting,
                                                 /*.error_code*/ "STATUS_CODE_FORMAT_DETECTING"};
        int64_t num_packets_;
        nlohmann::json info_;
    };

    using srt_stream_handler_uptr = std::unique_ptr<srt_stream_listener>;
} // namespace ebu_list::srt